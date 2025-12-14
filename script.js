// --- 1. SETUP & KEYS ---
// PASTE YOUR KEYS HERE
const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE';
const SUPABASE_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE';

const EMAILJS_PUBLIC_KEY = 'PASTE_YOUR_EMAILJS_PUBLIC_KEY_HERE';
const EMAILJS_SERVICE_ID = 'PASTE_YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'PASTE_YOUR_TEMPLATE_ID'; // Confirmation Template

// Initialize Clients
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
emailjs.init(EMAILJS_PUBLIC_KEY);

// State Variables
let selectedTime = null;

// --- DATA: GENERIC STAFF ROSTER ---
const staffRoster = {
    "Central": ["Head Barber", "Senior Stylist", "Stylist"],
    "Downtown": ["Manager", "Barber 1", "Barber 2"],
    "Uptown": ["Senior Barber", "Junior Barber"]
};

// --- 2. UI FUNCTIONS ---

function updateBarberList() {
    const locSelect = document.getElementById('locationSelect');
    const barberSelect = document.getElementById('barberSelect');
    const selectedLoc = locSelect.value;
    
    barberSelect.innerHTML = "";
    
    if (staffRoster[selectedLoc]) {
        barberSelect.disabled = false;
        barberSelect.style.opacity = "1";
        
        // Add default option
        const def = document.createElement('option');
        def.text = "Select Professional";
        def.disabled = true;
        def.selected = true;
        barberSelect.add(def);

        staffRoster[selectedLoc].forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            barberSelect.appendChild(opt);
        });
    }
}

function openModal() {
    document.getElementById('bookingModal').classList.add('active');
    const dateInput = document.getElementById('dateSelect');
    if (!dateInput.value) dateInput.valueAsDate = new Date();
}

function closeModal() {
    document.getElementById('bookingModal').classList.remove('active');
    backToStep1();
}

function resetTimeSlot() {
    selectedTime = null;
    loadAvailability();
}

function backToStep1() {
    document.getElementById('booking-step-1').style.display = 'block';
    document.getElementById('booking-step-2').style.display = 'none';
}

function toggleMobileNav() {
    document.querySelector('.nav-links').classList.toggle('active');
    document.body.classList.toggle('menu-open');
}

// --- 3. BOOKING LOGIC ---

async function loadAvailability() {
    const barber = document.getElementById('barberSelect').value;
    const date = document.getElementById('dateSelect').value;
    const container = document.getElementById('time-slots');
    const loading = document.getElementById('loading-text');

    if (!date || !barber || barber === "Select Professional") return;

    container.innerHTML = '';
    loading.style.display = 'block';

    const { data: bookings, error } = await supabaseClient
        .from('bookings')
        .select('booking_time')
        .eq('barber_name', barber)
        .eq('booking_date', date);

    loading.style.display = 'none';

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    const shopHours = [
        '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'
    ];

    const takenTimes = bookings ? bookings.map(b => b.booking_time.slice(0, 5)) : [];

    shopHours.forEach(time => {
        const btn = document.createElement('button');
        btn.innerText = time;
        btn.className = 'slot-btn';
        if (takenTimes.includes(time)) {
            btn.classList.add('taken');
            btn.disabled = true;
        } else {
            btn.onclick = () => selectTime(time, btn);
        }
        container.appendChild(btn);
    });
}

function selectTime(time, btnElement) {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btnElement.classList.add('selected');
    selectedTime = time;
    
    setTimeout(() => {
        document.getElementById('booking-step-1').style.display = 'none';
        document.getElementById('booking-step-2').style.display = 'block';
        document.getElementById('confirm-details-header').innerText = `Confirm: ${time} with ${document.getElementById('barberSelect').value}`;
    }, 300);
}

// --- 4. FINALIZE & SAVE ---
async function finalizeBooking() {
    const name = document.getElementById('custName').value;
    const email = document.getElementById('custEmail').value;
    const phone = document.getElementById('custPhone').value;
    const barber = document.getElementById('barberSelect').value;
    const date = document.getElementById('dateSelect').value;
    const location = document.getElementById('locationSelect').value;

    if (!name || !email || !phone) { alert("Please fill in all details."); return; }

    const btn = document.querySelector('#booking-step-2 .btn');
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    // A. Insert into Supabase
    const { data, error } = await supabaseClient
        .from('bookings')
        .insert([{
            customer_name: name,
            customer_email: email,
            customer_phone: phone,
            barber_name: barber,
            booking_date: date,
            booking_time: selectedTime,
            location: location
        }])
        .select();

    if (error) {
        if (error.code === '23505') {
            alert("Sorry! That slot was just taken.");
            backToStep1();
            loadAvailability();
        } else {
            alert("System Error: " + error.message);
        }
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }

    // B. Generate Manage Link
    const currentUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    const bookingId = data[0].id;
    const manageLink = `${currentUrl}/cancel.html?id=${bookingId}`;

    // C. Send Email
    const emailParams = {
        name: name,
        email: email,
        barber: barber,
        date: date,
        time: selectedTime,
        service: "Template Demo Service", 
        cancel_link: manageLink 
    };

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, emailParams)
        .then(() => {
            alert("Booking Confirmed! Check your email.");
            closeModal();
            document.getElementById('custName').value = '';
            document.getElementById('custEmail').value = '';
            document.getElementById('custPhone').value = '';
        }, (err) => {
            alert("Booking saved, but email failed to send.");
            console.error(err);
            closeModal();
        });
        
    btn.innerText = originalText;
    btn.disabled = false;
}