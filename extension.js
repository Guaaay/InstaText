/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'my-indicator-extension';

const { GObject, St } = imports.gi;
const { GLib } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const _ = ExtensionUtils.gettext;

function checkTesseract() {
    let [, out] = GLib.spawn_command_line_sync('which tesseract');
    if (!out || out.toString().trim() === "") {
        Main.notify('Please install Tesseract OCR for this extension to work. On Ubuntu, use `sudo apt install tesseract-ocr`');
        log("Tesseract not found.");
        return false;
    }
    log("Tesseract is installed and available.");
    return true;
}   

const Clipboard = St.Clipboard.get_default();

function copyToClipboard(text) {
    Clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
}


const { Gio } = imports.gi;

function runCommandAsync(command, callback) {
    // Start the command asynchronously and create pipes for communication
    let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
        null, // Working directory
        ["/bin/bash", "-c", command], // Command to run in shell
        null, // Environment variables
        GLib.SpawnFlags.DO_NOT_REAP_CHILD, // Flags
        null // Child setup function
    );

    if (!success) {
        log("Failed to start the async command.");
        return;
    }
    // Add a child watch to know when the process finishes
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
        // Check the exit status
        if (status === 0) {
            log("Command finished successfully!");
            // Call the next function, such as running OCR, here
            callback();
        } else {
            log(`Command exited with status ${status}`);
        }
        // Clean up the process
        GLib.spawn_close_pid(pid);
    });
}

function takeScreenshotAsync() {
    let screenshotPath = '/tmp/screenshot.png';
    let command = `gnome-screenshot -a -f ${screenshotPath}`;

    // Start the command asynchronously and create pipes for communication
    runCommandAsync(command, () => {
        // Call the OCR function here
        log("Screenshot taken successfully!");
        runOCR(screenshotPath);
    }
    );
}

function runOCR(screenshotPath) {
    // Here you can add the logic to run OCR on the screenshot
    log(`Processing screenshot at ${screenshotPath}...`);
    
    // The OCR command
    let command = `tesseract ${screenshotPath} stdout --dpi 300 2>/dev/null`;
    // Start the command asynchronously and create pipes for communication
    let [, stdout, stderr] = GLib.spawn_command_line_sync(command);
    // Check if the command was successful
    if (stdout) {
        // Copy the OCR result to the clipboard
        copyToClipboard(stdout.toString());
        Main.notify('OCR result copied to clipboard. Text: ' + stdout.toString());
        log("OCR result copied to clipboard.");
    } else {
        log("OCR failed."); 
    }

}

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('My Shiny Indicator'));

        this.add_child(new St.Icon({
            icon_name: 'applets-screenshooter-symbolic.png',
            style_class: 'system-status-icon',
        }));

        let item = new PopupMenu.PopupMenuItem(_('Take OCR screenshot'));
        item.connect('activate', () => {
            if(checkTesseract()){
                path = takeScreenshotAsync();
            }
            
        });
        this.menu.addMenuItem(item);
    }
});

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
