import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3LvE41AR9NefqZYkKi_IBRDy8eJZ-Ks0",
    authDomain: "acetylnet.firebaseapp.com",
    projectId: "acetylnet",
    storageBucket: "acetylnet.firebasestorage.app",
    messagingSenderId: "900802644153",
    appId: "1:900802644153:web:f65fdb91ad7e5a3ce57368"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;

signInAnonymously(auth).catch((error) => {
    console.error("Auth error:", error);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("Firebase AUTH UID:", user.uid);
        loadUserDomains();
    }
});

const urlBox = document.getElementById('urlBox');
const homeBtn = document.getElementById('homeBtn');
const dashBtn = document.getElementById('dashBtn');
const homeView = document.getElementById('homeView');
const dashView = document.getElementById('dashView');
const siteFrame = document.getElementById('siteFrame');
const htmlFileInput = document.getElementById('htmlFileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const domainInput = document.getElementById('domainInput');
const tldSelect = document.getElementById('tldSelect');
const publishBtn = document.getElementById('publishBtn');
const publishStatus = document.getElementById('publishStatus');

function showView(view) {
    homeView.classList.add('hidden');
    dashView.classList.add('hidden');
    siteFrame.classList.add('hidden');

    view.classList.remove('hidden');
}

showView(homeView)

homeBtn.addEventListener('click', () => {
    showView(homeView);
    urlBox.value = 'acetyl://home';
});

dashBtn.addEventListener('click', () => {
    showView(dashView);
    urlBox.value = 'acetyl://dashboard';
});

urlBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        let inputUrl = urlBox.value.trim().toLowerCase();

        if (inputUrl === 'acetyl://home' || inputUrl === 'acetyl://') {
            showView(homeView);
            urlBox.value = 'acetyl://home';
        } else if (inputUrl === 'acetyl://dashboard' || inputUrl === 'acetyl://dash') {
            showView(dashView);
            urlBox.value = 'acetyl://dashboard';
        } else {
            const domainKey = inputUrl.replace(/^acetyl:\/\//, '');
            
            if (domainKey) {
                loadSite(domainKey);
            }
        }

        urlBox.blur();
    }
});

let selectedFileContent = "";

htmlFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];

    if (file) {
        fileNameDisplay.textContent = `📄 ${file.name}`;

        const reader = new FileReader();
        reader.onload = (event) => {
            selectedFileContent = event.target.result;
            console.log("File content loaded into memory");
        };
        reader.readAsText(file);
    } else {
        fileNameDisplay.textContent = "Choose an .html file or drag it here";
        selectedFileContent = "";
    }
});

publishBtn.addEventListener('click', async () => {
    const rawDomain = domainInput.value.trim().toLowerCase();
    const selectedTld = tldSelect.value;
    
    const validDomainRegex = /^[a-z0-9-]{1,32}$/;

    if (!rawDomain || !validDomainRegex.test(rawDomain)) {
        alert("Invalid domain name. Use only letters, numbers, and hyphens (1-32 chars).");
        return;
    }

    if (!selectedFileContent) {
        alert("Please select an .html file to upload.");
        return;
    }

    if (!currentUser) {
        alert("Connecting to network... please try again in a moment.");
        return;
    }

    const fullDomainKey = `${rawDomain}${selectedTld}`;
    const fullDomainUrl = `acetyl://${fullDomainKey}`;

    try {
        publishBtn.disabled = true;
        publishBtn.textContent = "Publishing...";

        const domainRef = doc(db, "domains", fullDomainKey);
        const domainSnap = await getDoc(domainRef);

        const isUpdatingExisting = domainSnap.exists();

        if (isUpdatingExisting) {
            const domainData = domainSnap.data();
            if (domainData.ownerId !== currentUser.uid) {
                alert(`The domain ${fullDomainUrl} is already claimed by another user.`);
                publishBtn.disabled = false;
                publishBtn.textContent = "Publish Site";
                return;
            }
        } else {
            const domainsRef = collection(db, "domains");
            const userDomainsQuery = query(domainsRef, where("ownerId", "==", currentUser.uid));
            const userDomainsSnap = await getDocs(userDomainsQuery);

            if (userDomainsSnap.size >= 3) {
                alert("Domain limit reached.");
                publishBtn.disabled = false;
                publishBtn.textContent = "Publish Site";
                return;
            }
        }

        await setDoc(domainRef, {
            domainName: fullDomainKey,
            fullUrl: fullDomainUrl,
            htmlContent: selectedFileContent,
            ownerId: currentUser.uid,
            createdAt: isUpdatingExisting ? domainSnap.data().createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        alert(`Successfully published ${fullDomainUrl}`);
        console.log(`Published ${fullDomainUrl} to Firestore.`);

        // Refresh UI
        domainInput.value = "";
        fileNameDisplay.textContent = "Choose an .html file or drag it here";
        selectedFileContent = "";
        await loadUserDomains();
        
    } catch (err) {
        console.error("Firestore publish error:", err);
        alert("Failed to publish site. Check browser console.");
    } finally {
        publishBtn.disabled = false;
        publishBtn.textContent = "Publish Site";
    }
});

const myDomainsList = document.getElementById('myDomainsList');

async function loadUserDomains() {
    if (!currentUser) return;

    try {
        const domainsRef = collection(db, "domains");
        const q = query(domainsRef, where("ownerId", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            myDomainsList.innerHTML = `<p class="empty-msg">No domains registered yet.</p>`;
            return;
        }

        myDomainsList.innerHTML = ""; 

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const domainKey = data.domainName; 
            
            const domainRow = document.createElement('div');
            domainRow.className = 'domain-row';
            
            domainRow.innerHTML = `
                <div class="domain-info">
                    <span class="domain-row-name">${data.fullUrl}</span>
                    <span class="domain-row-date">${new Date(data.createdAt).toLocaleDateString()}</span>
                </div>
                <button class="delete-domain-btn" title="Delete">x</button>
            `;

            const infoArea = domainRow.querySelector('.domain-info');
            infoArea.style.cursor = 'pointer';
            infoArea.addEventListener('click', () => {
                urlBox.value = data.fullUrl;
                urlBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            });

            const deleteBtn = domainRow.querySelector('.delete-domain-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                const confirmed = confirm(`Are you sure you want to delete ${data.fullUrl}? This cannot be undone.`);
                if (!confirmed) return;

                try {
                    deleteBtn.disabled = true;
                    deleteBtn.textContent = "Deleting..."
                    await deleteDoc(doc(db, "domains", domainKey));
                    alert(`Deleted ${data.fullUrl}`);  
                    await loadUserDomains();

                } catch (err) {
                    console.error("Error deleting domain:", err);
                    alert("Failed to delete domain. Check browser console.");
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = "x";
                }
            });

            myDomainsList.appendChild(domainRow);
        });

    } catch (err) {
        console.error("Error loading user domains:", err);
    }
}

async function loadSite(domainKey) {
    try {
        const domainRef = doc(db, "domains", domainKey);
        const domainSnap = await getDoc(domainRef);

        if (domainSnap.exists()) {
            const siteData = domainSnap.data();
            showView(siteFrame);
            siteFrame.srcdoc = siteData.htmlContent;
            
        } else {
            showView(siteFrame);
            siteFrame.srcdoc = `
                <body style="background:#1a1a1e; color:white; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:90vh;">
                    <h1 style="font-size:3rem; margin-bottom:10px;">404 :(</h1>
                    <p style="color:#a0a0ab;">The domain <strong>acetyl://${domainKey}</strong> was not found on AcetylNet.</p>
                </body>
            `;
        }
    } catch (err) {
        console.error("Error loading site:", err);
        alert("Failed to load page.");
    }
}