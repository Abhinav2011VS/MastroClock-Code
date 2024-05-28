document.addEventListener('DOMContentLoaded', () => {
  const settingsForm = document.getElementById('settings-form');

  settingsForm.addEventListener('change', () => {
    const formData = new FormData(settingsForm);
    const settings = {
      showClock: formData.get('showClock') === 'on',
      showSeconds: formData.get('showSeconds') === 'on',
      draggable: formData.get('draggable') === 'on',
      translucent: formData.get('translucent') === 'on',
      startOnStartup: formData.get('startOnStartup') === 'on',
      animations: formData.get('animations') === 'on'
    };
    window.electron.sendSettings(settings);
  });
});
