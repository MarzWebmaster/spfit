// CRITICAL FIX for session restoration issue
// Problem: getInitialStateFromDB sets currentUser, preventing checkAuthToken from working
// Solution: Remove currentUser from getInitialStateFromDB and let checkAuthToken handle it

// Replace the getInitialStateFromDB function with this:
const getInitialStateFromDB = async () => {
  try {
    // Get settings from database (don't load currentUser here - let checkAuthToken handle it)
    const settingsKeys = [
      'spfit_webhooks',
      'spfit_notification_templates', 
      'spfit_roles',
      'spfit_default_freelancer_role_id',
      'spfit_smtp_settings'
    ];
    
    const settings = await settingsService.getSettingsByKeys(settingsKeys);
    
    return {
      webhooks: settings.spfit_webhooks ? JSON.parse(settings.spfit_webhooks) : WEBHOOKS_DATA,
      notificationTemplates: settings.spfit_notification_templates ? JSON.parse(settings.spfit_notification_templates) : NOTIFICATION_TEMPLATES,
      roles: settings.spfit_roles ? JSON.parse(settings.spfit_roles) : ROLES_DATA,
      defaultFreelancerRoleId: settings.spfit_default_freelancer_role_id ? parseInt(settings.spfit_default_freelancer_role_id) : 3,
      smtpSettings: settings.spfit_smtp_settings ? JSON.parse(settings.spfit_smtp_settings) : {
        server: '',
        port: 587,
        username: '',
        password: '',
        fromAddress: '',
        security: 'TLS'
      }
    };
  } catch (error) {
    console.error('Error loading initial state:', error);
    // Fallback to localStorage if database fails
    try {
      return {
        webhooks: JSON.parse(localStorage.getItem('spfit_webhooks') || JSON.stringify(WEBHOOKS_DATA)),
        notificationTemplates: JSON.parse(localStorage.getItem('spfit_notification_templates') || JSON.stringify(NOTIFICATION_TEMPLATES)),
        roles: JSON.parse(localStorage.getItem('spfit_roles') || JSON.stringify(ROLES_DATA)),
        defaultFreelancerRoleId: parseInt(localStorage.getItem('spfit_default_freelancer_role_id') || '3'),
        smtpSettings: JSON.parse(localStorage.getItem('spfit_smtp_settings') || JSON.stringify({
          server: '',
          port: 587,
          username: '',
          password: '',
          fromAddress: '',
          security: 'TLS'
        }))
      };
    } catch (fallbackError) {
      console.error('Error parsing localStorage data:', fallbackError);
      return {
        webhooks: WEBHOOKS_DATA,
        notificationTemplates: NOTIFICATION_TEMPLATES,
        roles: ROLES_DATA,
        defaultFreelancerRoleId: 3,
        smtpSettings: {
          server: '',
          port: 587,
          username: '',
          password: '',
          fromAddress: '',
          security: 'TLS'
        }
      };
    }
  }
};

// Also update the initializeApp function to remove currentUser initialization:
// Replace this line:
// setCurrentUser(initialState.currentUser);
// With: (remove the line completely)

// And remove this condition:
// if (token && initialState.currentUser) {
//   setView('dashboard');
// }
// With: (remove the condition completely)

// The checkAuthToken useEffect will handle session restoration properly