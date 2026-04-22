(function () {
  // Injects the shared Settings modal shell into the page if it's not already there.
  // The Library tab on the dashboard provides its own panel (#settings-panel-library)
  // inline in index.html. This script only provides the outer shell + the Top tabs +
  // Global + Chart Builder panels that every page can have.

  function inject() {
    if (document.getElementById('settings-modal')) return; // Dashboard already has one
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
      return;
    }
    const host = document.createElement('div');
    host.innerHTML = html;
    while (host.firstChild) document.body.appendChild(host.firstChild);
  }

  const html = `
  <div class="settings-modal-backdrop" id="settings-modal-backdrop" hidden></div>
  <aside class="settings-modal" id="settings-modal" hidden>
    <div class="settings-modal-inner">
      <div class="panel-header settings-modal-header" id="settings-modal-header">
        <div>
          <p class="section-label">Settings</p>
          <h2>Settings</h2>
        </div>
        <div class="panel-actions">
          <button class="button button-primary" id="settings-modal-ok-button" type="button">OK</button>
          <button class="button button-secondary" id="settings-modal-close-button" type="button">Cancel</button>
        </div>
      </div>
      <div class="settings-modal-tabs" id="settings-modal-tabs" role="tablist" aria-label="Settings sections"></div>

      <div class="settings-modal-panel" id="settings-panel-toptabs" hidden>
        <div class="tt-subtabs">
          <button class="tt-subtab is-active" id="tt-subtab-light" type="button">Light mode</button>
          <button class="tt-subtab" id="tt-subtab-dark" type="button">Dark mode</button>
        </div>
        <section class="tt-section">
          <h3 class="tt-section-title">Words when selected</h3>
          <div class="tt-grid">
            <label class="tt-field"><span>Color</span><input type="color" id="tt-sel-color"></label>
            <label class="tt-field"><span>Font</span>
              <select id="tt-sel-font">
                <option value="'Space Grotesk', system-ui, sans-serif">Space Grotesk</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Verdana, sans-serif">Verdana</option>
              </select>
            </label>
            <label class="tt-field"><span>Font size</span><input type="number" id="tt-sel-size" min="10" max="48" step="1"></label>
            <label class="tt-field tt-check"><input type="checkbox" id="tt-sel-bold"><span>Bold</span></label>
            <label class="tt-field tt-check"><input type="checkbox" id="tt-sel-italic"><span>Italic</span></label>
            <label class="tt-field"><span>Transparency</span><input type="range" id="tt-sel-opacity" min="0" max="100" step="1"></label>
          </div>
        </section>
        <section class="tt-section">
          <h3 class="tt-section-title">Words when not selected</h3>
          <div class="tt-grid">
            <label class="tt-field"><span>Color</span><input type="color" id="tt-idle-color"></label>
            <label class="tt-field"><span>Font</span>
              <select id="tt-idle-font">
                <option value="'Space Grotesk', system-ui, sans-serif">Space Grotesk</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Verdana, sans-serif">Verdana</option>
              </select>
            </label>
            <label class="tt-field"><span>Font size</span><input type="number" id="tt-idle-size" min="10" max="48" step="1"></label>
            <label class="tt-field tt-check"><input type="checkbox" id="tt-idle-bold"><span>Bold</span></label>
            <label class="tt-field tt-check"><input type="checkbox" id="tt-idle-italic"><span>Italic</span></label>
            <label class="tt-field"><span>Transparency</span><input type="range" id="tt-idle-opacity" min="0" max="100" step="1"></label>
          </div>
        </section>
        <section class="tt-section">
          <h3 class="tt-section-title">Underline</h3>
          <div class="tt-grid">
            <label class="tt-field"><span>Color</span><input type="color" id="tt-underline-color"></label>
            <label class="tt-field"><span>Width</span><input type="number" id="tt-underline-width" min="0" max="10" step="1"></label>
          </div>
        </section>
        <section class="tt-section">
          <h3 class="tt-section-title">Bar</h3>
          <div class="tt-grid">
            <label class="tt-field"><span>Background color</span><input type="color" id="tt-bar-background"></label>
          </div>
        </section>
      </div>

      <div class="settings-modal-panel" id="settings-panel-saved-states" hidden>
        <section class="tt-section">
          <h3 class="tt-section-title">Saved States</h3>
          <p style="margin:0 0 10px;font-size:11px;color:#6a7280;">Snapshots of Top bar and Chart Builder settings.</p>
          <button class="button button-primary" id="ss-save-current" type="button">Save current</button>
          <div id="ss-list" style="margin-top:12px;"></div>
        </section>
      </div>

      <div class="settings-modal-panel" id="settings-panel-global" hidden>
        <section class="tt-section">
          <h3 class="tt-section-title">Theme</h3>
          <div class="tt-grid">
            <label class="tt-field tt-check"><input type="checkbox" id="gs-dark"><span>Dark mode</span></label>
          </div>
        </section>
      </div>

      <div class="settings-modal-panel" id="settings-panel-cb" hidden>
        <div class="tt-subtabs">
          <button class="tt-subtab is-active" id="cb-subtab-light" type="button">Light mode</button>
          <button class="tt-subtab" id="cb-subtab-dark" type="button">Dark mode</button>
          <button class="tt-subtab" id="cb-subtab-other" type="button">Other</button>
        </div>

        <div id="cb-subpanel-light">
          <section class="tt-section">
            <h3 class="tt-section-title">New chart defaults (Light)</h3>
            <div id="cb-defaults-sections-light"></div>
          </section>
          <section class="tt-section">
            <h3 class="tt-section-title">Splash card (Light)</h3>
            <div class="tt-grid">
              <label class="tt-field"><span>Background</span><input type="color" id="cb-card-light-background"></label>
              <label class="tt-field"><span>Border color</span><input type="color" id="cb-card-light-border-color"></label>
              <label class="tt-field"><span>Border width</span><input type="number" min="0" max="6" step="1" id="cb-card-light-border-width"></label>
              <label class="tt-field"><span>Label color</span><input type="color" id="cb-card-light-label-color"></label>
              <label class="tt-field"><span>Label size</span><input type="number" min="10" max="22" step="1" id="cb-card-light-label-size"></label>
            </div>
          </section>
          <section class="tt-section">
            <h3 class="tt-section-title">Chart frame (Light)</h3>
            <div class="tt-grid">
              <label class="tt-field"><span>Background</span><input type="color" id="cb-card-light-frame-background"></label>
              <label class="tt-field"><span>Border color</span><input type="color" id="cb-card-light-frame-border-color"></label>
              <label class="tt-field"><span>Border width</span><input type="number" min="0" max="6" step="1" id="cb-card-light-frame-border-width"></label>
              <label class="tt-field"><span>Corner radius</span><input type="number" min="0" max="24" step="1" id="cb-card-light-frame-radius"></label>
            </div>
          </section>
        </div>

        <div id="cb-subpanel-dark" hidden>
          <section class="tt-section">
            <h3 class="tt-section-title">New chart defaults (Dark)</h3>
            <div id="cb-defaults-sections-dark"></div>
          </section>
          <section class="tt-section">
            <h3 class="tt-section-title">Splash card (Dark)</h3>
            <div class="tt-grid">
              <label class="tt-field"><span>Background</span><input type="color" id="cb-card-dark-background"></label>
              <label class="tt-field"><span>Border color</span><input type="color" id="cb-card-dark-border-color"></label>
              <label class="tt-field"><span>Border width</span><input type="number" min="0" max="6" step="1" id="cb-card-dark-border-width"></label>
              <label class="tt-field"><span>Label color</span><input type="color" id="cb-card-dark-label-color"></label>
              <label class="tt-field"><span>Label size</span><input type="number" min="10" max="22" step="1" id="cb-card-dark-label-size"></label>
            </div>
          </section>
          <section class="tt-section">
            <h3 class="tt-section-title">Chart frame (Dark)</h3>
            <div class="tt-grid">
              <label class="tt-field"><span>Background</span><input type="color" id="cb-card-dark-frame-background"></label>
              <label class="tt-field"><span>Border color</span><input type="color" id="cb-card-dark-frame-border-color"></label>
              <label class="tt-field"><span>Border width</span><input type="number" min="0" max="6" step="1" id="cb-card-dark-frame-border-width"></label>
              <label class="tt-field"><span>Corner radius</span><input type="number" min="0" max="24" step="1" id="cb-card-dark-frame-radius"></label>
            </div>
          </section>
        </div>

        <div id="cb-subpanel-other" hidden>
          <section class="tt-section">
            <h3 class="tt-section-title">Preferences</h3>
            <div class="tt-grid">
              <label class="tt-field tt-check"><input type="checkbox" id="cb-prefs-dark"><span>Display dark-themed charts as new charts</span></label>
              <label class="tt-field">
                <span>Preview size</span>
                <input type="range" id="cb-preview-size" min="120" max="360" step="10" value="200">
              </label>
            </div>
            <div class="tt-grid" style="margin-top:10px;">
              <button class="button button-secondary" id="cb-restore-defaults" type="button">Restore new chart defaults</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </aside>`;

  inject();
})();
