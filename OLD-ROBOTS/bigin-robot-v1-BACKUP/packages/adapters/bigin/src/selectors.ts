/**
 * Bigin Selectors - CSS selectors for Zoho Bigin
 *
 * NOTA: Estos selectores pueden cambiar cuando Zoho actualice su UI.
 * Necesitarán ajuste basándose en tu instancia real de Bigin.
 */

export const BiginSelectors = {
  // Login page
  login: {
    emailInput: '#login_id',
    nextButton: '#nextbtn',
    passwordInput: '#password',
    signInButton: '#nextbtn',
    // OTP verification (individual digit fields)
    otpDigitInputs: 'input[type="tel"][placeholder="●"]',
    otpVerifyButton: 'button:has-text("Verify")',
    // OneAuth push notification
    pushNotificationTitle: 'h2:has-text("Verify push notification"), div:has-text("Verify push notification")',
    pushNotificationNumber: '.onpush_verify_number, div[class*="number"]',
    signInAnotherWay: 'div:has-text("Sign in another way"):visible',
    signInWithPassword: 'a:has-text("Sign in using password")',
    // OneAuth passphrase
    passphraseInput: 'input[type="password"][placeholder*="passphrase"], input[placeholder*="passphrase"]',
    passphraseSubmit: 'button[type="submit"]:has-text("Sign in"), button:has-text("Continue")',
    // Alternativas si Zoho cambia
    emailAlt: 'input[name="LOGIN_ID"]',
    passwordAlt: 'input[name="PASSWORD"]'
  },

  // Post-login screens
  postLogin: {
    timezoneTitle: 'text=Update your time zone',
    timezoneRemindLater: 'text=Remind me later',
    timezoneUpdate: 'text=Update'
  },

  // Main navigation
  nav: {
    leadsTab: 'a[href*="/tab/Leads"]',
    leadsTabAlt: '[data-zcqa="leads_tab"]',
    pipelinesTab: 'text=Pipelines',
    contactsTab: 'text=Contacts',
    homeButton: '.crm_logo',
    // Any of these indicates we're in the Bigin dashboard
    dashboardIndicator: 'text=Pipelines, text=Team Pipelines, [class*="pipeline"]'
  },

  // Leads list
  leadsList: {
    searchBox: '#globalSearch',
    searchBoxAlt: 'input[placeholder*="Search"]',
    searchResults: '.lv_row',
    firstLead: '.lv_row:first-child',
    leadRow: (leadId: string) => `[data-id="${leadId}"]`,
    noResults: '.emptyContainer'
  },

  // Lead detail view
  leadDetail: {
    leadName: '.crm_detail_title',
    phoneField: '[data-field="Phone"]',
    emailField: '[data-field="Email"]',
    stageField: '[data-field="Lead_Status"]',
    editButton: '#detailEdit',
    saveButton: '#detailSave'
  },

  // Create lead
  createLead: {
    newButton: '#createNewButton',
    firstNameInput: '[name="First Name"]',
    lastNameInput: '[name="Last Name"]',
    phoneInput: '[name="Phone"]',
    emailInput: '[name="Email"]',
    companyInput: '[name="Company"]',
    saveButton: '#detailSave',
    cancelButton: '#detailCancel'
  },

  // Notes
  notes: {
    notesTab: '[data-tab="Notes"]',
    addNoteButton: '#addNote',
    noteTextarea: '#noteContent',
    saveNoteButton: '#saveNote',
    notesContainer: '.notes-container'
  },

  // Common
  common: {
    loadingSpinner: '.crm_loader',
    successMessage: '.success_message',
    errorMessage: '.error_message',
    closeButton: '.close_button'
  },

  // Orden (Order) creation
  orden: {
    createButton: 'button:has-text("+ Trato"), button:has-text("+Trato"), button:has-text("Trato"), button:has-text("Orden"), button:has-text("+Orden")',
    form: {
      // Use label-based selectors for reliability
      // Include both English and Spanish versions
      ordenName: 'label:has-text("Nombre del Trato") ~ input, label:has-text("Orden Name") ~ input, label:has-text("Orden Name") + div input, [name*="ordenName"], [name*="Orden_Name"], [name*="Deal_Name"]',
      contactName: 'label:has-text("Nombre del Contacto") ~ input, label:has-text("Contact Name") ~ input, label:has-text("Contact Name") + div input',
      subPipeline: 'label:has-text("Sub-Pipeline") ~ div, label:has-text("Sub Pipeline") ~ div',
      stage: 'text=Choose a stage, text=Escoja una etapa, text=Seleccionar etapa',
      closingDate: 'label:has-text("Fecha de Cierre") ~ input, label:has-text("Closing Date") ~ input, input[placeholder*="DD/MM"], input[placeholder*="MM/DD"]',
      amount: 'label:has-text("Monto") ~ input, label:has-text("Cantidad") ~ input, label:has-text("Amount") ~ input, [name*="Amount"], [name*="amount"]',
      telefono: 'label:has-text("Teléfono") ~ input, label:has-text("Telefono") ~ input, [name*="Telefono"]',
      direccion: 'label:has-text("Dirección") ~ input, label:has-text("Direccion") ~ input, [name*="Direcci"]',
      municipio: 'label:has-text("Municipio") ~ input, [name*="Municipio"]',
      departamento: 'label:has-text("Departamento") ~ input, [name*="Departamento"]',
      email: 'label:has-text("Correo") ~ input, label:has-text("email") ~ input, label:has-text("Email") ~ input, [name*="email"]',
      description: 'label:has-text("Descripción") ~ textarea, label:has-text("Description") ~ textarea, textarea:visible',
      callBell: 'label:has-text("CallBell") ~ input, [name*="CallBell"]',
      transportadora: 'label:has-text("Transportadora") ~ input, [name*="Transportadora"]',
      guia: 'label:has-text("Guía") ~ input, label:has-text("Guia") ~ input, [name*="Guia"]',
      saveButton: 'button:has-text("Guardar"), button:has-text("Save")',
      cancelButton: 'button:has-text("Cancelar"), button:has-text("Cancel")'
    }
  }
};
