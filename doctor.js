/**
 * Medical Records Management System - Doctor Portal
 * Firebase Cloud Database Edition (Works Across Devices!)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, get, push } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase Configuration (MUST MATCH patient app.js exactly)
const firebaseConfig = {
  apiKey: "AIzaSyAlb49UB4gpjsj42dUb4xY7F1Ubgj3QuMA",
  authDomain: "ipr-opd-platform.firebaseapp.com",
  databaseURL: "https://ipr-opd-platform-default-rtdb.firebaseio.com",
  projectId: "ipr-opd-platform",
  storageBucket: "ipr-opd-platform.firebasestorage.app",
  messagingSenderId: "941612976287",
  appId: "1:941612976287:web:43a6e4f68e2a44d6d73aaa"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Global Variables
let doctorProfile = null;
let currentPatient = null;
let currentPatientUserId = null;
let medicineCounter = 0;

/**
 * Get or create doctor session ID
 */
function getDoctorSessionId() {
  let sessionId = getCookie('doctor_session');
  if (!sessionId) {
    sessionId = generateUUID();
    setCookie('doctor_session', sessionId, 365);
  }
  return sessionId;
}

/**
 * Cookie helpers
 */
function setCookie(name, value, days) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Load Doctor Profile from Firebase
 */
async function loadDoctorProfile() {
  try {
    const sessionId = getDoctorSessionId();
    const profileRef = ref(database, `doctors/${sessionId}/profile`);
    const snapshot = await get(profileRef);
    
    if (snapshot.exists()) {
      doctorProfile = snapshot.val();
      return true;
    }
  } catch (error) {
    console.error('Error loading doctor profile:', error);
  }
  return false;
}

/**
 * Check Doctor Profile Status
 */
async function checkDoctorProfile() {
  const profileBox = document.getElementById('doctorProfileBox');
  const accessBox = document.getElementById('accessBox');

  const hasProfile = await loadDoctorProfile();
  
  if (!hasProfile) {
    profileBox.style.display = 'block';
    accessBox.style.display = 'none';
  } else {
    profileBox.style.display = 'none';
    accessBox.style.display = 'block';
  }
}

/**
 * Save Doctor Profile to Firebase
 */
async function saveDoctorProfile() {
  const name = document.getElementById('d-name').value.trim();
  const specialization = document.getElementById('d-spec').value.trim();
  const license = document.getElementById('d-license').value.trim();
  const hospital = document.getElementById('d-hospital').value.trim();
  const contact = document.getElementById('d-contact').value.trim();
  const email = document.getElementById('d-email').value.trim();

  if (!name || !specialization) {
    showNotification('Please fill all required fields', 'error');
    return;
  }

  if (email && !isValidEmail(email)) {
    showNotification('Please enter a valid email address', 'error');
    return;
  }

  doctorProfile = {
    name,
    specialization,
    license,
    hospital,
    contact,
    email,
    createdAt: new Date().toISOString()
  };

  try {
    const sessionId = getDoctorSessionId();
    await set(ref(database, `doctors/${sessionId}/profile`), doctorProfile);
    
    showNotification('Doctor profile saved successfully', 'success');
    await checkDoctorProfile();
  } catch (error) {
    console.error('Error saving doctor profile:', error);
    showNotification('Failed to save profile', 'error');
  }
}

/**
 * Access Patient Records using Token
 */
async function accessRecords() {
  const inputToken = document.getElementById('tokenInput').value.trim().toUpperCase();

  if (!inputToken) {
    showNotification('Please enter an access token', 'error');
    return;
  }

  try {
    console.log('Accessing token:', inputToken);
    
    // Get token from Firebase
    const tokenRef = ref(database, `tokens/${inputToken}`);
    const tokenSnapshot = await get(tokenRef);
    
    if (!tokenSnapshot.exists()) {
      showNotification('Invalid access token', 'error');
      console.error('Token not found in database');
      return;
    }

    const storedToken = tokenSnapshot.val();
    console.log('Token data:', storedToken);

    // Check if token is expired
    if (Date.now() > storedToken.expiry) {
      showNotification('Access token has expired', 'error');
      return;
    }

    // Get patient user ID from token
    const patientUserId = storedToken.userId;
    currentPatientUserId = patientUserId;
    console.log('Patient user ID:', patientUserId);

    // Load patient profile
    const profileRef = ref(database, `users/${patientUserId}/profile`);
    const profileSnapshot = await get(profileRef);
    
    if (!profileSnapshot.exists()) {
      showNotification('Patient profile not found', 'error');
      console.error('Profile not found for user:', patientUserId);
      return;
    }

    const patientProfile = profileSnapshot.val();
    console.log('Patient profile loaded:', patientProfile);

    // Load patient records
    const recordsRef = ref(database, `users/${patientUserId}/records`);
    const recordsSnapshot = await get(recordsRef);
    
    let records = [];
    if (recordsSnapshot.exists()) {
      recordsSnapshot.forEach((childSnapshot) => {
        records.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
    }
    console.log('Records loaded:', records.length);

    currentPatient = patientProfile;
    displayPatientRecords(patientProfile, records);
    document.getElementById('prescriptionBox').style.display = 'block';
    document.getElementById('medicineList').innerHTML = '';
    medicineCounter = 0;
    
    showNotification('Patient records accessed successfully!', 'success');
  } catch (error) {
    console.error('Error accessing records:', error);
    showNotification('Failed to access patient records: ' + error.message, 'error');
  }
}

/**
 * Display Patient Records
 */
function displayPatientRecords(patient, records) {
  const view = document.getElementById('doctorView');

  // Sort records by date
  const sortedRecords = records.sort((a, b) => new Date(b.date) - new Date(a.date));

  view.innerHTML = `
    <div class="section-card">
      <div class="card-header">
        <h3 class="section-title">Patient Information</h3>
        <span style="color: #22c55e; font-size: 0.875rem;">☁️ Cloud Synced</span>
      </div>
      <div class="patient-details-grid">
        <div class="detail-item">
          <span class="detail-label">Name:</span>
          <span class="detail-value">${patient.name}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Age:</span>
          <span class="detail-value">${patient.age} years</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Gender:</span>
          <span class="detail-value">${patient.sex}</span>
        </div>
        ${patient.bloodGroup ? `
          <div class="detail-item">
            <span class="detail-label">Blood Group:</span>
            <span class="detail-value">${patient.bloodGroup}</span>
          </div>
        ` : ''}
        ${patient.contact ? `
          <div class="detail-item">
            <span class="detail-label">Contact:</span>
            <span class="detail-value">${patient.contact}</span>
          </div>
        ` : ''}
        ${patient.email ? `
          <div class="detail-item">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${patient.email}</span>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="section-card">
      <div class="card-header">
        <h3 class="section-title">Medical History</h3>
        <span class="record-count">${records.length} record${records.length !== 1 ? 's' : ''}</span>
      </div>
      ${records.length === 0 ? 
        '<div class="empty-state">No medical records available</div>' : 
        sortedRecords.map(record => generateDoctorRecordView(record)).join('')
      }
    </div>
  `;
}

/**
 * Generate Doctor's View of Record
 */
function generateDoctorRecordView(record) {
  const date = new Date(record.date);
  const formattedDate = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let content = '';

  if (record.generatedBy === 'patient' && record.files) {
    content = `
      <div class="record-files">
        ${record.files.map(f => `
          <div class="file-item-compact">
            <span class="file-icon">📄</span>
            <span class="file-name">${f.fileName}</span>
            <span class="file-meta">${formatFileSize(f.fileSize)}</span>
            <button onclick="openPatientFile('${record.id}')" class="btn btn-sm btn-outline">View File</button>
          </div>
        `).join('')}
      </div>
      ${record.notes ? `<div class="record-notes"><strong>Notes:</strong> ${record.notes}</div>` : ''}
    `;
  }

  if (record.generatedBy === 'doctor' && record.prescription) {
    const rx = record.prescription;
    content = `
      <div class="prescription-view">
        <div class="rx-section">
          <span class="rx-label">Diagnosis:</span>
          <span class="rx-value">${rx.diagnosis}</span>
        </div>
        <div class="rx-section">
          <span class="rx-label">Medications:</span>
          <ul class="rx-medicine-list">
            ${rx.medicines.map(m => `
              <li>${m.name} - ${m.pattern} for ${m.days} days</li>
            `).join('')}
          </ul>
        </div>
        ${rx.advice ? `
          <div class="rx-section">
            <span class="rx-label">Advice:</span>
            <span class="rx-value">${rx.advice}</span>
          </div>
        ` : ''}
        ${rx.followUpDate ? `
          <div class="rx-section">
            <span class="rx-label">Follow-up:</span>
            <span class="rx-value">${new Date(rx.followUpDate).toLocaleDateString()}</span>
          </div>
        ` : ''}
        ${rx.clinicalNotes ? `
          <div class="rx-section">
            <span class="rx-label">Clinical Notes:</span>
            <span class="rx-value">${rx.clinicalNotes}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="medical-record-card">
      <div class="record-header">
        <div>
          <h4 class="record-title">${record.title}</h4>
          <div class="record-meta">
            <span>Date: ${formattedDate}</span>
            <span>Provider: ${record.doctor}</span>
          </div>
        </div>
        <span class="badge badge-${record.type.replace(/\s+/g, '-').toLowerCase()}">${record.type}</span>
      </div>
      <div class="record-content">
        ${content}
      </div>
    </div>
  `;
}

/**
 * Open Patient File (from Firebase)
 */
async function openPatientFile(recordId) {
  if (!currentPatientUserId) {
    showNotification('Patient data not available', 'error');
    return;
  }

  try {
    // Get the specific record
    const recordRef = ref(database, `users/${currentPatientUserId}/records/${recordId}`);
    const recordSnapshot = await get(recordRef);
    
    if (!recordSnapshot.exists()) {
      showNotification('File not found', 'error');
      return;
    }

    const record = recordSnapshot.val();
    
    if (!record.files || !record.files[0]) {
      showNotification('No file attached to this record', 'error');
      return;
    }

    const file = record.files[0];
    
    if (file.base64Data) {
      const win = window.open();
      win.document.write(`
        <html>
          <head>
            <title>${file.fileName}</title>
            <style>
              body { margin: 0; padding: 0; background: #f0f0f0; }
              img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
              iframe { width: 100%; height: 100vh; border: none; }
            </style>
          </head>
          <body>
            ${file.mimeType.startsWith('image/') 
              ? `<img src="${file.base64Data}" alt="${file.fileName}">` 
              : `<iframe src="${file.base64Data}"></iframe>`
            }
          </body>
        </html>
      `);
      showNotification('File opened successfully', 'success');
    } else {
      showNotification('File data not available', 'error');
    }
  } catch (error) {
    console.error('Error opening file:', error);
    showNotification('Failed to open file', 'error');
  }
}

/**
 * Add Medicine Row
 */
function addMedicineRow() {
  medicineCounter++;
  const list = document.getElementById('medicineList');

  const medicineRow = document.createElement('div');
  medicineRow.className = 'medicine-row';
  medicineRow.id = `medicine-${medicineCounter}`;
  medicineRow.innerHTML = `
    <div class="medicine-fields">
      <div class="form-group">
        <label class="form-label">Medication Name <span class="required">*</span></label>
        <input type="text" class="form-input med-name" placeholder="e.g., Paracetamol 650mg" required>
      </div>
      <div class="form-group">
        <label class="form-label">Dosage Pattern <span class="required">*</span></label>
        <input type="text" class="form-input med-pattern" placeholder="e.g., 1-1-1 or 1-0-1" required>
      </div>
      <div class="form-group">
        <label class="form-label">Duration (days) <span class="required">*</span></label>
        <input type="number" class="form-input med-days" placeholder="e.g., 5" min="1" required>
      </div>
    </div>
    <button type="button" onclick="removeMedicineRow(${medicineCounter})" class="btn-remove" title="Remove medication">×</button>
  `;

  list.appendChild(medicineRow);
}

/**
 * Remove Medicine Row
 */
function removeMedicineRow(id) {
  const row = document.getElementById(`medicine-${id}`);
  if (row) {
    row.remove();
  }
}

/**
 * Save Prescription to Firebase
 */
async function savePrescription() {
  const diagnosis = document.getElementById('diag').value.trim();
  const advice = document.getElementById('advice').value.trim();
  const followup = document.getElementById('followup').value;
  const notes = document.getElementById('notes').value.trim();

  if (!diagnosis) {
    showNotification('Please enter a diagnosis', 'error');
    return;
  }

  // Collect medicines
  const nameInputs = document.querySelectorAll('.med-name');
  const patternInputs = document.querySelectorAll('.med-pattern');
  const daysInputs = document.querySelectorAll('.med-days');

  if (nameInputs.length === 0) {
    showNotification('Please add at least one medication', 'error');
    return;
  }

  const medicines = [];
  for (let i = 0; i < nameInputs.length; i++) {
    const name = nameInputs[i].value.trim();
    const pattern = patternInputs[i].value.trim();
    const days = daysInputs[i].value.trim();

    if (!name || !pattern || !days) {
      showNotification('Please fill all medication fields', 'error');
      return;
    }

    medicines.push({ name, pattern, days: parseInt(days) });
  }

  if (!currentPatientUserId) {
    showNotification('Patient information not available', 'error');
    return;
  }

  // Create prescription record
  const prescription = {
    generatedBy: 'doctor',
    title: 'Doctor Prescription',
    date: new Date().toISOString().split('T')[0],
    doctor: `${doctorProfile.name} (${doctorProfile.specialization})`,
    type: 'Prescription',
    prescription: {
      diagnosis,
      medicines,
      advice,
      followUpDate: followup,
      clinicalNotes: notes
    },
    createdAt: new Date().toISOString()
  };

  try {
    // Save prescription to Firebase
    const recordsRef = ref(database, `users/${currentPatientUserId}/records`);
    await push(recordsRef, prescription);
    
    showNotification('Prescription saved to cloud!', 'success');
    clearPrescriptionForm();
    
    // Refresh patient view
    if (currentPatient) {
      const recordsSnapshot = await get(recordsRef);
      let records = [];
      if (recordsSnapshot.exists()) {
        recordsSnapshot.forEach((childSnapshot) => {
          records.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
      }
      displayPatientRecords(currentPatient, records);
    }
  } catch (error) {
    console.error('Error saving prescription:', error);
    showNotification('Failed to save prescription', 'error');
  }
}

/**
 * Clear Prescription Form
 */
function clearPrescriptionForm() {
  document.getElementById('diag').value = '';
  document.getElementById('advice').value = '';
  document.getElementById('followup').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('medicineList').innerHTML = '';
  medicineCounter = 0;
}

/**
 * Utility Functions
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification notification-${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

/**
 * Initialize
 */
document.addEventListener('DOMContentLoaded', () => {
  checkDoctorProfile();
});

// Make functions globally accessible
window.saveDoctorProfile = saveDoctorProfile;
window.accessRecords = accessRecords;
window.openPatientFile = openPatientFile;
window.addMedicineRow = addMedicineRow;
window.removeMedicineRow = removeMedicineRow;
window.savePrescription = savePrescription;
window.clearPrescriptionForm = clearPrescriptionForm;