/**
 * Bigin Selectors - CSS selectors for Zoho Bigin
 * (Igual que v1 - no cambian)
 */

export const BiginSelectors = {
  // Login page
  login: {
    emailInput: '#login_id',
    nextButton: '#nextbtn',
    passwordInput: '#password',
    signInButton: '#nextbtn',
    otpDigitInputs: 'input[type="tel"][placeholder="●"]',
    pushNotificationTitle: 'h2:has-text("Verify push notification"), div:has-text("Verify push notification")',
    passphraseInput: 'input[type="password"][placeholder*="passphrase"], input[placeholder*="passphrase"]',
    passphraseSubmit: 'button[type="submit"]:has-text("Sign in"), button:has-text("Continue")',
  },

  // Post-login screens
  postLogin: {
    timezoneTitle: 'text=Update your time zone',
    timezoneRemindLater: 'text=Remind me later',
  },

  // Main navigation
  nav: {
    leadsTab: 'a[href*="/tab/Leads"]',
    dashboardIndicator: 'text=Pipelines, text=Team Pipelines, [class*="pipeline"]'
  },

  // Orden (Order) creation
  orden: {
    createButton: 'button:has-text("+ Trato"), button:has-text("+Trato"), button:has-text("Trato"), button:has-text("Orden"), button:has-text("+Orden")',
    form: {
      saveButton: 'button:has-text("Guardar"), button:has-text("Save")',
      cancelButton: 'button:has-text("Cancelar"), button:has-text("Cancel")'
    }
  }
};
