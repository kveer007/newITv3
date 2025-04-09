// Utility function to format dates as DD/MM/YYYY
function formatDate(date) {
    const d = new Date(date);
    const day = ("0" + d.getDate()).slice(-2);
    const month = ("0" + (d.getMonth() + 1)).slice(-2);
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // Generic Tracker Class
  class Tracker {
    constructor(config) {
        this.type = config.type;
        this.unit = config.unit;
        this.goalKey = `${this.type}Goal`;
        this.intakeKey = `${this.type}Intake`;
        this.historyKey = `dailyHistory_${this.type}`;
        this.reminderKey = `reminderTime_${this.type}`;
        this.lastResetKey = `lastResetDate_${this.type}`;
  
        this.goal = parseInt(localStorage.getItem(this.goalKey)) || 0;
        this.totalIntake = parseInt(localStorage.getItem(this.intakeKey)) || 0;
        this.dailyHistory = JSON.parse(localStorage.getItem(this.historyKey)) || {};
        this.reminderInterval = null;
  
        this.totalDisplay = document.getElementById(`${this.type}-total`);
        this.remainingDisplay = document.getElementById(`${this.type}-remaining`);
        this.progressBar = document.getElementById(`${this.type}-progress-bar`);
        this.goalInput = document.getElementById(`${this.type}-goal`);
        this.reminderInput = document.getElementById(`${this.type}-reminder-time`);
        this.manualInput = document.getElementById(`${this.type}-manual`);
        this.settingsSection = document.getElementById(`${this.type}-settings-section`);
        this.historyPopup = document.getElementById(`${this.type}-history-popup`);
        this.dailyHistoryTab = document.getElementById(`${this.type}-daily-history`);
        this.currentIntakeTab = document.getElementById(`${this.type}-current-intake`);
  
        this.updateDisplay();
        this.checkAndResetDailyIntake();
        setInterval(() => this.checkAndResetDailyIntake(), 60000);
    }
  
    updateDisplay() {
        this.totalDisplay.innerText = this.totalIntake;
        const remaining = this.goal > this.totalIntake ? this.goal - this.totalIntake : 0;
        this.remainingDisplay.innerText = remaining;
        this.updateProgressBar();
        localStorage.setItem(this.intakeKey, this.totalIntake);
    }
  
    updateProgressBar() {
        let progress = this.goal > 0 ? (this.totalIntake / this.goal) * 100 : 0;
        this.progressBar.style.width = Math.min(progress, 100) + "%";
    }
  
    setGoal() {
        const inputGoal = parseInt(this.goalInput.value);
        if (isNaN(inputGoal) || inputGoal <= 0) {
            alert("Please enter a valid goal (a positive number).");
            return;
        }
        this.goal = inputGoal;
        localStorage.setItem(this.goalKey, this.goal);
        this.updateDisplay();
    }
  
    addIntake(amount) {
        if (amount <= 0) return;
        this.totalIntake += amount;
        this.saveDailyHistory(amount);
        this.updateDisplay();
        this.refreshHistory();
    }
  
    addManualIntake() {
        const amount = parseInt(this.manualInput.value);
        if (!isNaN(amount) && amount > 0) {
            this.addIntake(amount);
            this.manualInput.value = "";
        } else {
            alert(`Please enter a positive number.`);
        }
    }
  
    saveDailyHistory(amount) {
        const currentDate = formatDate(new Date());
        if (!this.dailyHistory[currentDate]) {
            this.dailyHistory[currentDate] = [];
        }
        this.dailyHistory[currentDate].push(amount);
        localStorage.setItem(this.historyKey, JSON.stringify(this.dailyHistory));
    }
  
    refreshHistory() {
        this.showDailyHistory();
        this.showCurrentIntake();
    }
  
    setReminder() {
        const time = parseInt(this.reminderInput.value);
        if (!isNaN(time) && time > 0) {
            if (this.reminderInterval) clearInterval(this.reminderInterval);
            
            if (Notification.permission === "granted") {
                this.startReminder(time);
            } else {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        this.startReminder(time);
                    } else {
                        alert("Please enable notifications to receive reminders.");
                    }
                });
            }
        } else {
            alert("Please enter a valid time interval in minutes.");
        }
    }
  
    startReminder(time) {
      console.log("⏱ Setting reminder for:", this.type, "every", time, "minutes");
    
      // Start the local notification loop
      this.reminderInterval = setInterval(() => {
        new Notification(`Time to log your ${this.type} intake!`);
      }, time * 60 * 1000);
    
      // Save the interval locally
      localStorage.setItem(this.reminderKey, time);
    
      // 🔁 Send to Make.com only for water tracker
      if (this.type === "water") {
        console.log("📤 Preparing to send data to Make.com...");
    
        OneSignal.push(() => {
          OneSignal.getUserId().then(playerId => {
            if (!playerId) {
              console.warn("⚠️ Player ID not found. User may not be subscribed to OneSignal.");
              return;
            }
    
            fetch("https://hook.eu2.make.com/wu9s6i4pnzeo3nhz1qzwsdy9qqlgzcyx", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                playerID: playerId,
                intervalMinutes: time
              })
            })
            .then(res => {
              console.log("✅ Sent to Make.com. Response:", res.status);
              return res.text();
            })
            .then(text => console.log("📨 Make.com response:", text))
            .catch(err => console.error("❌ Error sending to Make.com:", err));
          });
        });
      }
    }
     
    checkAndResetDailyIntake() {
        const currentDate = formatDate(new Date());
        const lastResetDate = localStorage.getItem(this.lastResetKey);
        if (lastResetDate !== currentDate) {
            this.resetDailyIntake();
            localStorage.setItem(this.lastResetKey, currentDate);
        }
        const now = new Date();
        const millisUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0) - now;
        setTimeout(() => this.checkAndResetDailyIntake(), millisUntilMidnight);
    }
  
    resetDailyIntake() {
        const currentDate = formatDate(new Date());
        if (this.dailyHistory[currentDate]) {
            this.dailyHistory[currentDate] = [];
            localStorage.setItem(this.historyKey, JSON.stringify(this.dailyHistory));
        }
        this.totalIntake = 0;
        localStorage.setItem(this.intakeKey, this.totalIntake);
        this.updateDisplay();
        this.refreshHistory();
    }
    
    showDailyHistory() {
        if (!this.dailyHistoryTab) return;
        
        this.dailyHistoryTab.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const dates = Object.keys(this.dailyHistory).sort((a, b) => {
          const dateA = a.split('/').reverse().join('');
          const dateB = b.split('/').reverse().join('');
          return dateB.localeCompare(dateA); // Most recent first
        }).slice(0, 7); // Last 7 days
        
        if (dates.length === 0) {
          const noData = document.createElement('p');
          noData.textContent = 'No history data available.';
          fragment.appendChild(noData);
        } else {
          dates.forEach(date => {
            const entries = this.dailyHistory[date];
            const totalAmount = entries.reduce((sum, amount) => sum + amount, 0);
            
            const dayEntry = document.createElement('div');
            dayEntry.className = 'day-entry';
            
            const dateText = document.createElement('p');
            dateText.innerHTML = `<b>${date}</b>`;
            dayEntry.appendChild(dateText);
            
            const totalText = document.createElement('p');
            totalText.textContent = `Total: ${totalAmount} ${this.unit}`;
            dayEntry.appendChild(totalText);
            
            const goalPercent = document.createElement('p');
            const percentage = this.goal > 0 ? Math.round((totalAmount / this.goal) * 100) : 0;
            goalPercent.textContent = `${percentage}% of daily goal`;
            dayEntry.appendChild(goalPercent);
            
            fragment.appendChild(dayEntry);
          });
        }
        
        this.dailyHistoryTab.appendChild(fragment);
        this.dailyHistoryTab.classList.add('active');
        if (this.currentIntakeTab) {
          this.currentIntakeTab.classList.remove('active');
        }
    }
    
    showCurrentIntake() {
        if (!this.currentIntakeTab) return;
        
        this.currentIntakeTab.innerHTML = '';
        const currentDate = formatDate(new Date());
        const entries = this.dailyHistory[currentDate] || [];
        
        const container = document.createElement('div');
        
        const header = document.createElement('h3');
        header.textContent = `Today's ${this.type.charAt(0).toUpperCase() + this.type.slice(1)} Intake`;
        container.appendChild(header);
        
        if (entries.length === 0) {
          const noEntries = document.createElement('p');
          noEntries.textContent = `No ${this.type} intake recorded today.`;
          container.appendChild(noEntries);
        } else {
          const total = entries.reduce((sum, amount) => sum + amount, 0);
                   
          const remaining = this.goal > total ? this.goal - total : 0;
          const remainingInfo = document.createElement('p');
          remainingInfo.innerHTML = `Remaining: <b>${remaining} ${this.unit}</b>`;
          container.appendChild(remainingInfo);
          
          const entriesHeader = document.createElement('h4');
          entriesHeader.textContent = 'Individual Entries:';
          container.appendChild(entriesHeader);
          
          const entriesList = document.createElement('ul');
          
          entries.forEach((amount, index) => {
            const entry = document.createElement('li');
            entry.textContent = `Entry ${index + 1}: ${amount} ${this.unit}`;
            entriesList.appendChild(entry);
          });
          
          container.appendChild(entriesList);
        }
        
        this.currentIntakeTab.appendChild(container);
    }
  }
  
  // Instantiate trackers
  const proteinTracker = new Tracker({ type: "protein", unit: "g" });
  const waterTracker = new Tracker({ type: "water", unit: "ml" });
  
  // Initialize event listeners when the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', () => {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const appContainers = document.querySelectorAll('.app-container');
    
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const appType = btn.dataset.app;
        
        // Update button active state
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update visible app container
        appContainers.forEach(container => {
          container.classList.remove('active');
          if (container.id === `${appType}-app`) {
            container.classList.add('active');
          }
        });
      });
    });
    
    // Settings toggles
    document.getElementById('water-settings-toggle').addEventListener('click', () => {
      document.getElementById('water-settings-section').classList.toggle('active');
      document.getElementById('water-history-popup').classList.remove('active');
    });
    
    document.getElementById('protein-settings-toggle').addEventListener('click', () => {
      document.getElementById('protein-settings-section').classList.toggle('active');
      document.getElementById('protein-history-popup').classList.remove('active');
    });
    
    // History toggles
    document.getElementById('water-history-toggle').addEventListener('click', () => {
      document.getElementById('water-history-popup').classList.toggle('active');
      document.getElementById('water-settings-section').classList.remove('active');
      waterTracker.refreshHistory();
    });
    
    document.getElementById('protein-history-toggle').addEventListener('click', () => {
      document.getElementById('protein-history-popup').classList.toggle('active');
      document.getElementById('protein-settings-section').classList.remove('active');
      proteinTracker.refreshHistory();
    });
    
    // Water buttons
    document.querySelectorAll('[data-action="water-add"]').forEach(btn => {
      btn.addEventListener('click', () => {
        waterTracker.addIntake(parseInt(btn.dataset.amount));
      });
    });
    
    document.getElementById('water-add-manual').addEventListener('click', () => {
      waterTracker.addManualIntake();
    });
    
    document.getElementById('water-set-goal').addEventListener('click', () => {
      waterTracker.setGoal();
    });
    
    document.getElementById('water-set-reminder').addEventListener('click', () => {
      waterTracker.setReminder();
    });
    
    document.getElementById('water-reset-daily').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset today\'s water intake?')) {
        waterTracker.resetDailyIntake();
      }
    });
    
    document.getElementById('water-reset-data').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset ALL water tracking data?')) {
        localStorage.removeItem('waterGoal');
        localStorage.removeItem('waterIntake');
        localStorage.removeItem('dailyHistory_water');
        localStorage.removeItem('reminderTime_water');
        localStorage.removeItem('lastResetDate_water');
        location.reload();
      }
    });
    
    document.getElementById('water-enable-notifications').addEventListener('click', () => {
      
OneSignal.push(function () {
  OneSignal.registerForPushNotifications();
});

    });
    
    // Protein buttons
    document.querySelectorAll('[data-action="protein-add"]').forEach(btn => {
      btn.addEventListener('click', () => {
        proteinTracker.addIntake(parseInt(btn.dataset.amount));
      });
    });
    
    document.getElementById('protein-add-manual').addEventListener('click', () => {
      proteinTracker.addManualIntake();
    });
    
    document.getElementById('protein-set-goal').addEventListener('click', () => {
      proteinTracker.setGoal();
    });
    
    document.getElementById('protein-set-reminder').addEventListener('click', () => {
      proteinTracker.setReminder();
    });
    
    document.getElementById('protein-reset-daily').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset today\'s protein intake?')) {
        proteinTracker.resetDailyIntake();
      }
    });
    
    document.getElementById('protein-reset-data').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset ALL protein tracking data?')) {
        localStorage.removeItem('proteinGoal');
        localStorage.removeItem('proteinIntake');
        localStorage.removeItem('dailyHistory_protein');
        localStorage.removeItem('reminderTime_protein');
        localStorage.removeItem('lastResetDate_protein');
        location.reload();
      }
    });
    
    document.getElementById('protein-enable-notifications').addEventListener('click', () => {
      
OneSignal.push(function () {
  OneSignal.registerForPushNotifications();
});

    });
    
    // Inner tab navigation in history popups
    document.querySelectorAll('.tab-button').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const tabId = tabBtn.dataset.tab;
        const tabsContainer = tabBtn.closest('.history-popup');
        
        // Update active state for buttons
        tabsContainer.querySelectorAll('.tab-button').forEach(b => {
          b.classList.remove('active');
        });
        tabBtn.classList.add('active');
        
        // Show active tab content
        tabsContainer.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');
      });
    });
    
    // Initialize history tabs
    document.getElementById('water-daily-history').classList.add('active');
    document.getElementById('protein-daily-history').classList.add('active');
    
    // Initialize trackers and history
    waterTracker.refreshHistory();
    proteinTracker.refreshHistory();
  
// Water notification & Make.com integration
OneSignal.push(function () {
  OneSignal.registerForPushNotifications();
});

OneSignal.push(function() {
  OneSignal.getUserId().then(function(playerId) {
    if (playerId) {
      const intervalMinutes = localStorage.getItem("reminderTime_water") || "not set";

      fetch("https://hook.eu2.make.com/vwhoxdpwus8l8vwxj2cq9liaxk8t213o", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          playerID: playerId,
          intervalMinutes: intervalMinutes
        })
      });
    }
  });
});

});
