/**
 * Medical Records Management System - Patient Portal
 * Firebase Cloud Database Edition (Works Across Devices!)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, get, push, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase Configuration
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
let patientProfile = null;
let allRecords = [];
let currentUserId = null;

/**
 * Generate or Get User ID from Firebase
 */
async function getUserId() {
  if (currentUserId) return currentUserId;

  // Check URL parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('userId');
  
  if (urlUserId) {
    currentUserId = urlUserId;
    return currentUserId;
  }

  // Try to get from a cookie or session identifier
  const sessionId = getSessionId();
  
  // Check if this session has a stored user ID in Firebase
  const sessionRef = ref(database, `sessions/${sessionId}`);
  const sessionSnapshot = await get(sessionRef);
  
  if (sessionSnapshot.exists()) {
    currentUserId = sessionSnapshot.val().userId;
  } else {
    // Create new user
    currentUserId = generateUUID();
    await set(sessionRef, {
      userId: currentUserId,
      createdAt: new Date().toISOString()
    });
  }
  
  return currentUserId;
}

/**
 * Get or create session ID (using a simple cookie)
 */
function getSessionId() {
  let sessionId = getCookie('medrecords_session');
  if (!sessionId) {
    sessionId = generateUUID();
    setCookie('medrecords_session', sessionId, 365);
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
 * Load Patient Profile from Firebase
 */
async function loadPatientProfile() {
  try {
    const userId = await getUserId();
    const profileRef = ref(database, `users/${userId}/profile`);
    const snapshot = await get(profileRef);
    
    if (snapshot.exists()) {
      patientProfile = snapshot.val();
      return true;
    }
  } catch (error) {
    console.error('Error loading patient profile:', error);
  }
  return false;
}

/**
 * Check and Display Patient Profile Status
 */
async function checkPatientProfile() {
  const profileBox = document.getElementById('patientProfileBox');
  const actionsBox = document.getElementById('mainActions');

  const hasProfile = await loadPatientProfile();
  
  if (!hasProfile) {
    profileBox.style.display = 'block';
    actionsBox.style.display = 'none';
  } else {
    profileBox.style.display = 'none';
    actionsBox.style.display = 'block';
    displayPatientInfo();
    await loadRecords();
    renderTimeline();
  }
}

/**
 * Display Patient Information
 */
function displayPatientInfo() {
  const infoBar = document.getElementById('patientInfo');
  
  if (patientProfile) {
    infoBar.innerHTML = `
      <div class="info-item"><strong>Name:</strong> ${patientProfile.name}</div>
      <div class="info-item"><strong>Age:</strong> ${patientProfile.age}</div>
      <div class="info-item"><strong>Gender:</strong> ${patientProfile.sex}</div>
      ${patientProfile.bloodGroup ? `<div class="info-item"><strong>Blood Group:</strong> ${patientProfile.bloodGroup}</div>` : ''}
      <div class="info-item"><span style="color: #22c55e; font-size: 0.75rem;">☁️ Cloud Synced</span></div>
      <button onclick="editPatientProfile()" class="btn btn-sm btn-outline" style="margin-left: auto;">Edit Profile</button>
    `;
  }
}

/**
 * Edit Patient Profile
 */
function editPatientProfile() {
  if (!confirm('Are you sure you want to edit your profile?')) {
    return;
  }
  
  document.getElementById('p-name').value = patientProfile.name || '';
  document.getElementById('p-age').value = patientProfile.age || '';
  document.getElementById('p-sex').value = patientProfile.sex || '';
  document.getElementById('p-blood').value = patientProfile.bloodGroup || '';
  document.getElementById('p-contact').value = patientProfile.contact || '';
  document.getElementById('p-email').value = patientProfile.email || '';
  
  document.getElementById('patientProfileBox').style.display = 'block';
  document.getElementById('mainActions').style.display = 'none';
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Reset All Patient Data
 */
async function resetAllData() {
  if (!confirm('⚠️ WARNING: This will delete ALL data from cloud. Continue?')) return;
  if (!confirm('Final warning. All data will be permanently deleted. Continue?')) return;
  
  try {
    const userId = await getUserId();
    const sessionId = getSessionId();
    
    await remove(ref(database, `users/${userId}`));
    await remove(ref(database, `sessions/${sessionId}`));
    
    // Clear cookie
    document.cookie = 'medrecords_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    currentUserId = null;
    
    showNotification('All data has been reset', 'success');
    setTimeout(() => location.reload(), 1000);
  } catch (error) {
    console.error('Error resetting data:', error);
    showNotification('Failed to reset data', 'error');
  }
}

/**
 * Save Patient Profile to Firebase
 */
async function savePatientProfile() {
  const name = document.getElementById('p-name').value.trim();
  const age = document.getElementById('p-age').value;
  const sex = document.getElementById('p-sex').value;
  const bloodGroup = document.getElementById('p-blood').value;
  const contact = document.getElementById('p-contact').value.trim();
  const email = document.getElementById('p-email').value.trim();

  if (!name || !age || !sex) {
    showNotification('Please fill all required fields', 'error');
    return;
  }

  if (age < 1 || age > 150) {
    showNotification('Please enter a valid age', 'error');
    return;
  }

  if (email && !isValidEmail(email)) {
    showNotification('Please enter a valid email address', 'error');
    return;
  }

  patientProfile = {
    name,
    age: parseInt(age),
    sex,
    bloodGroup,
    contact,
    email,
    createdAt: new Date().toISOString()
  };

  try {
    const userId = await getUserId();
    await set(ref(database, `users/${userId}/profile`), patientProfile);
    
    showNotification('Patient profile saved to cloud!', 'success');
    await checkPatientProfile();
  } catch (error) {
    console.error('Error saving profile:', error);
    showNotification('Failed to save profile', 'error');
  }
}

/**
 * Load Records from Firebase
 */
async function loadRecords() {
  try {
    const userId = await getUserId();
    const recordsRef = ref(database, `users/${userId}/records`);
    const snapshot = await get(recordsRef);
    
    allRecords = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        allRecords.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
    }
  } catch (error) {
    console.error('Error loading records:', error);
    allRecords = [];
  }
}

/**
 * Show Add Record Form
 */
function showForm() {
  document.getElementById('formBox').style.display = 'block';
  document.getElementById('formBox').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Clear Add Record Form
 */
function clearForm() {
  document.getElementById('title').value = '';
  document.getElementById('datetime').value = '';
  document.getElementById('doctor').value = '';
  document.getElementById('type').value = '';
  document.getElementById('file').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('fileInfo').innerHTML = '';
  document.getElementById('formBox').style.display = 'none';
}

/**
 * Add Medical Record to Firebase
 */
async function addRecord() {
  const title = document.getElementById('title').value.trim();
  const date = document.getElementById('datetime').value;
  const doctor = document.getElementById('doctor').value.trim();
  const type = document.getElementById('type').value;
  const notes = document.getElementById('notes').value.trim();
  const fileInput = document.getElementById('file');

  if (!title || !date || !doctor || !type) {
    showNotification('Please fill all required fields', 'error');
    return;
  }

  if (fileInput.files.length === 0) {
    showNotification('Please upload a document', 'error');
    return;
  }

  const file = fileInput.files[0];
  
  if (file.size > 10 * 1024 * 1024) {
    showNotification('File size must be less than 10MB', 'error');
    return;
  }

  try {
    showNotification('Processing file...', 'info');
    
    // Convert file to base64
    const base64Data = await fileToBase64(file);
    
    const fileData = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      base64Data: base64Data
    };

    const record = {
      generatedBy: 'patient',
      title,
      date,
      doctor,
      type,
      notes,
      files: [fileData],
      createdAt: new Date().toISOString()
    };

    // Save to Firebase
    const userId = await getUserId();
    const recordsRef = ref(database, `users/${userId}/records`);
    await push(recordsRef, record);
    
    showNotification('Medical record saved to cloud!', 'success');
    clearForm();
    await loadRecords();
    renderTimeline();
  } catch (error) {
    console.error('Error adding record:', error);
    showNotification('Failed to add record: ' + error.message, 'error');
  }
}

/**
 * Convert File to Base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Render Medical Timeline
 */
function renderTimeline() {
  const timeline = document.getElementById('timeline');
  const filterType = document.getElementById('filterType')?.value || '';
  const filterSource = document.getElementById('filterSource')?.value || '';

  let filteredRecords = allRecords.filter(record => {
    const typeMatch = !filterType || record.type === filterType;
    const sourceMatch = !filterSource || record.generatedBy === filterSource;
    return typeMatch && sourceMatch;
  });

  filteredRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filteredRecords.length === 0) {
    timeline.innerHTML = '<div class="empty-state">No medical records available. Add your first record to get started.</div>';
    return;
  }

  timeline.innerHTML = filteredRecords.map((record) => {
    return generateRecordCard(record);
  }).join('');
}

/**
 * Generate Record Card HTML
 */
function generateRecordCard(record) {
  const date = new Date(record.date);
  const formattedDate = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let content = '';

  if (record.generatedBy === 'patient') {
    content = `
      <div class="record-files">
        ${record.files.map((f) => `
          <div class="file-item">
            <span class="file-name">${f.fileName}</span>
            <span class="file-size">${formatFileSize(f.fileSize)}</span>
            <button onclick="openFile('${record.id}')" class="btn btn-sm btn-outline">View</button>
          </div>
        `).join('')}
      </div>
      ${record.notes ? `<div class="record-notes"><strong>Notes:</strong> ${record.notes}</div>` : ''}
    `;
  } else if (record.generatedBy === 'doctor' && record.prescription) {
    const rx = record.prescription;
    content = `
      <div class="prescription-details">
        <div class="prescription-section">
          <strong>Diagnosis:</strong>
          <p>${rx.diagnosis}</p>
        </div>
        <div class="prescription-section">
          <strong>Medications:</strong>
          <ul class="medicine-list">
            ${rx.medicines.map(m => `
              <li>
                <div class="med-name">${m.name}</div>
                <div class="med-dosage">Dosage: ${m.pattern}</div>
                <div class="med-duration">Duration: ${m.days} days</div>
              </li>
            `).join('')}
          </ul>
        </div>
        ${rx.advice ? `
          <div class="prescription-section">
            <strong>Medical Advice:</strong>
            <p>${rx.advice}</p>
          </div>
        ` : ''}
        ${rx.followUpDate ? `
          <div class="prescription-section">
            <strong>Follow-up Date:</strong>
            <p>${new Date(rx.followUpDate).toLocaleDateString()}</p>
          </div>
        ` : ''}
        ${rx.clinicalNotes ? `
          <div class="prescription-section">
            <strong>Clinical Notes:</strong>
            <p>${rx.clinicalNotes}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="timeline-card">
      <div class="card-content">
        <div class="card-header-row">
          <h4 class="card-title">${record.title}</h4>
          <span class="badge badge-${record.type.replace(/\s+/g, '-').toLowerCase()}">${record.type}</span>
        </div>
        <div class="card-meta">
          <span class="meta-item">Date: ${formattedDate}</span>
          <span class="meta-item">Provider: ${record.doctor}</span>
          <span class="meta-item">Source: ${record.generatedBy === 'patient' ? 'Patient Upload' : 'Doctor Prescription'}</span>
        </div>
        ${content}
        <div class="card-actions">
          <button onclick="deleteRecord('${record.id}')" class="btn btn-sm btn-danger">Delete Record</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Open File
 */
async function openFile(recordId) {
  const record = allRecords.find(r => r.id === recordId);
  if (!record || !record.files || !record.files[0]) {
    showNotification('File not found', 'error');
    return;
  }
  
  const file = record.files[0];
  
  if (file.base64Data) {
    const win = window.open();
    win.document.write(`
      <html>
        <head><title>${file.fileName}</title></head>
        <body style="margin:0;">
          ${file.mimeType.startsWith('image/') 
            ? `<img src="${file.base64Data}" style="max-width:100%;height:auto;">` 
            : `<iframe src="${file.base64Data}" style="width:100%;height:100vh;border:none;"></iframe>`
          }
        </body>
      </html>
    `);
  } else {
    showNotification('File not found', 'error');
  }
}

/**
 * Delete Medical Record from Firebase
 */
async function deleteRecord(recordId) {
  if (!confirm('Are you sure you want to delete this medical record?')) {
    return;
  }

  try {
    const userId = await getUserId();
    await remove(ref(database, `users/${userId}/records/${recordId}`));
    
    await loadRecords();
    renderTimeline();
    showNotification('Record deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting record:', error);
    showNotification('Failed to delete record', 'error');
  }
}

/**
 * Generate Access Token for Doctor
 */
async function generateToken() {
  const token = generateSecureToken();
  const expiry = Date.now() + 30 * 60 * 1000;
  const userId = await getUserId();

  const accessToken = { 
    token, 
    expiry, 
    userId: userId,
    generatedAt: new Date().toISOString() 
  };
  
  try {
    // Save token to Firebase (accessible to anyone with the token)
    await set(ref(database, `tokens/${token}`), accessToken);
    
    const expiryTime = new Date(expiry).toLocaleTimeString();
    document.getElementById('tokenDisplay').innerHTML = `
      <div class="token-card">
        <div class="token-header">Doctor Access Token Generated</div>
        <div class="token-value">${token}</div>
        <div class="token-info">
          <span>Valid for 30 minutes</span>
          <span>Expires at: ${expiryTime}</span>
        </div>
        <div class="token-info">
          <span style="color: #22c55e;">✓ This token works on ANY device</span>
        </div>
        <button onclick="copyToken('${token}')" class="btn btn-sm btn-secondary">Copy Token</button>
      </div>
    `;
    
    showNotification('Access token generated and saved to cloud!', 'success');
  } catch (error) {
    console.error('Error generating token:', error);
    showNotification('Failed to generate token', 'error');
  }
}

/**
 * Copy Token to Clipboard
 */
function copyToken(token) {
  navigator.clipboard.writeText(token).then(() => {
    showNotification('Token copied to clipboard', 'success');
  }).catch(() => {
    showNotification('Failed to copy token', 'error');
  });
}

/**
 * Export Records as JSON
 */
async function exportRecords() {
  if (allRecords.length === 0) {
    showNotification('No records to export', 'warning');
    return;
  }

  const exportData = {
    patient: patientProfile,
    records: allRecords,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medical-records-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showNotification('Records exported successfully', 'success');
}

/**
 * Filter Records
 */
function filterRecords() {
  renderTimeline();
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

function generateSecureToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
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
  checkPatientProfile();
  
  const fileInput = document.getElementById('file');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('fileInfo').innerHTML = `
          <div class="selected-file">
            <strong>Selected:</strong> ${file.name} (${formatFileSize(file.size)})
          </div>
        `;
      }
    });
  }
});

// Make functions globally accessible
window.savePatientProfile = savePatientProfile;
window.editPatientProfile = editPatientProfile;
window.resetAllData = resetAllData;
window.showForm = showForm;
window.clearForm = clearForm;
window.addRecord = addRecord;
window.deleteRecord = deleteRecord;
window.generateToken = generateToken;
window.copyToken = copyToken;
window.exportRecords = exportRecords;
window.filterRecords = filterRecords;
window.openFile = openFile;