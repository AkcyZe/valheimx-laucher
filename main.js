const { app, BrowserWindow, ipcMain, shell, remote, dialog } = require('electron');
const { download } = require('electron-dl');
const { autoUpdater } = require('electron-updater');

const path = require("path");
const fs = require('fs')
const isAdmin = require('is-admin');
const execFile = require('child_process').execFile;
const glob = require("glob");
const crypto = require('crypto');
const ps = require('ps-node');

require('electron-reloader')(module);

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

const isDevBuild = false;

let browserWindow;
let isGameStarted = false;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let userPreferencePath;
let gameFolderPath;
let defaultGameFolderPath;
let prevGameFolderPath;

function createWindow() {
    browserWindow = new BrowserWindow({
        width: 1040,
        height: 640,
        frame: false,
        resizable: false,
        transparent: true,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    if (isDevBuild) {
        browserWindow.webContents.openDevTools();
    }

    browserWindow.on('closed', () => {
        browserWindow = null
    })

    browserWindow.loadFile(path.join(__dirname, '/dist/index.html')).then(() => {
        console.log("Index loaded.")
    });
}

const cyrillicPattern = /[а-яА-ЯЁё]/;
const isCyrillicExists = (path) => {
    return cyrillicPattern.test(path);
}

const getNewGamePath = async (force = false) => {
    const result = await dialog.showOpenDialog(browserWindow, {
        title: "Выберите папку установки клиента. Путь должен содержать только ЛАТИНСКИЕ СИМВОЛЫ",
        buttonLabel: "Выбрать",
        defaultPath: defaultGameFolderPath,
        properties: ['openDirectory'],
    });

    if (result.canceled && !force) {
        return null;
    }

    let newPath = result.filePaths[0];
    if (isCyrillicExists(newPath)) {
        await dialog.showMessageBox({
            title: "Ошибка",
            message: "Путь до клиента должен содержать только клиентские символы"
        })

        newPath = await getNewGamePath(force);
    }

    return newPath;
};

const getGameFolder = (serverName) => {
    return path.join(gameFolderPath, serverName).replace(/\\/g, '/');
}

const createGameFolder = (serverName) => {
    const gamePath = path.join(gameFolderPath, serverName);

    if (!fs.existsSync(gamePath)) {
        fs.mkdirSync(gamePath);
    }
}

const initPaths = async () => {
    const userDataPath = (app || remote).getPath('userData');

    let userPreference;

    gameFolderPath = path.join(userDataPath, 'Servers');
    userPreferencePath = path.join(userDataPath, 'user-preference.json');
    if (fs.existsSync(userPreferencePath)) {
        const stringData = fs.readFileSync(userPreferencePath, { encoding: 'utf8' });
        userPreference = JSON.parse(stringData) ?? {};
        if (userPreference.GameFolder && userPreference.GameFolder.length) {
            gameFolderPath = userPreference.GameFolder;
        }
    }

    if (!gameFolderPath || isCyrillicExists(gameFolderPath)) {
        gameFolderPath = await getNewGamePath(true);

        if (userPreference && gameFolderPath) {
            userPreference.GameFolder = gameFolderPath;

            fs.writeFileSync(userPreferencePath, JSON.stringify(userPreference));
        }
    }

    defaultGameFolderPath = gameFolderPath

    initGameFolder(gameFolderPath);
}

const initGameFolder = (path) => {
    if (gameFolderPath) {
        prevGameFolderPath = gameFolderPath;
    }

    gameFolderPath = path;

    if (!fs.existsSync(gameFolderPath)) {
        fs.mkdirSync(gameFolderPath);
    }
}

app.commandLine.appendSwitch("disable-http-cache");
app.whenReady().then(() => {
    createWindow();

    initPaths();
})

app.on('window-all-closed', app.quit);
ipcMain.on('close', app.quit);

console.log(app.getPath('userData'));

ipcMain.on('check-for-updates', async (event) => {
    let result;

    try {
        if (isDevBuild) {
            result = await autoUpdater.checkForUpdates();
        } else {
            result = await autoUpdater.checkForUpdatesAndNotify();
        }
    } catch (error) {
        result = null;
    }

    if (!result || result.updateInfo && result.updateInfo.version == autoUpdater.currentVersion.version) {
        browserWindow.webContents.send('check-for-updates-result', null);

        return;
    }

    browserWindow.webContents.send('check-for-updates-result', JSON.stringify(result));
});

ipcMain.on('install-update', (event) => {
   autoUpdater.downloadUpdate();
});

/*
* Emit on update downloaded
* */
autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall();
});

/*
* Launcher should be started only with admin rights
* */
ipcMain.handle('checkOnAdminRights', (e, data) => {
    return new Promise((resolve, reject) => {
        isAdmin().then(result => {
            resolve(result);
        }, error => {
            reject(error);
        })
    });
});

/*
* Calculate client hash table for update/delete files
* */
ipcMain.handle('getHashTable', async (event, serverName) => {
    return new Promise((resolve, reject) => {

        createGameFolder(serverName);

       try {
           console.log(`${getGameFolder(serverName)}/**/*`);
           glob(`${getGameFolder(serverName)}/**/*`, { nodir: true }, (err, res) => {
               if (err) {
                   return reject(err);
               }

               let hashTable = [];

               res.forEach(path => {
                   const fileBuffer = fs.readFileSync(path);
                   const hashSum = crypto.createHash('md5');

                   hashSum.update(fileBuffer);

                   hashTable.push({
                       hash: hashSum.digest('hex').toUpperCase(),
                       path: path.replace(`${getGameFolder(serverName)}/`, "")
                   });
               });

               resolve(hashTable);
           });
       } catch (error) {
           reject(error);
       }
    });
});

/*
* Delete old file
* */
ipcMain.handle('delete-file', async (e, serverName, path) => {
    return new Promise(async (resolve, reject) => {
       try {
           path = `${getGameFolder(serverName)}/${path}`;

           console.log(`Deleting: ${path}`);

           if (fs.existsSync(path)) {
               fs.unlinkSync(path);
           }

           resolve();
       } catch (error) {
           reject(error);
       }
    });
});

/*
* Delete all files
* */
ipcMain.handle('delete-all-file', async (e, serverName) => {
   return new Promise((resolve, reject) => {
       try {
           createGameFolder(serverName);

           glob(`${getGameFolder(serverName)}/**/*`, { nodir: true }, (err, res) => {
               if (err) {
                   return reject(err);
               }

               res.forEach(path => {
                   if (fs.existsSync(path)) {
                       fs.unlinkSync(path)
                   }
               });

               resolve();
           });
       } catch (error) {
           reject(error);
       }
   }) ;
});

/*
* Download client file
* */
ipcMain.handle('download-file', async (e, serverName, url, path) => {
   return new Promise(async (resolve, reject) => {
       const filename = path.replace(/^.*[\\\/]/, '')
       const storagePath = path.replace(filename, '');

       console.log(`Downloading: ${path}`);

       try {
           await download(browserWindow, `${url}/${path}`, {
               directory: `${getGameFolder(serverName)}\\${storagePath}`,
               onProgress: (progress) => {
                   browserWindow.webContents.send('download-progress', filename, progress);
               },
               onCompleted: (file) => {
                   resolve();
               },
           });
       } catch (error) {
           reject(error);
       }
   });
});

/*
* Start game and connect to server
* */
ipcMain.handle('startGame', (event, params) => {
    return new Promise((resolve, reject) => {
        try {
            let url = `${getGameFolder(params.server)}/valheim.exe`;

            isGameStarted = true;

            execFile(url, params.launchParams, () => { });

            resolve();
        } catch (error) {
            reject(error);
        }
    });
});

ipcMain.handle('isProcessRunning', (event, params) => {
    return new Promise((resolve, reject) => {
        isProcessRunning(params, (status) => {
            resolve(status);
        })
    });
});

ipcMain.on('get-version', (e) => {
    browserWindow.webContents.send('version', autoUpdater.currentVersion);
});

ipcMain.on('openGameFolder', (e, serverName) => {
    shell.openPath(getGameFolder(serverName));
});

ipcMain.on('openLogFolder', (e, serverName) => {
    shell.openExternal(path.join(getGameFolder(serverName), 'BepInEx/LogOutput.log'));
});

const isProcessRunning = (query, cb) => {
    ps.lookup({
        command: query
    }, (error, result) => {
        if (error) {
            cb(false);

            console.error(error);

            return;
        }

        if (result && result.length > 0) {
            cb(true);

            console.log(`Process (${query}) found.`)

            return;
        }

        console.log(`Process (${query}) not found.`)

        cb(false);
    })
}

setInterval(() => {
    if (isGameStarted) {
        isProcessRunning('valheim.exe', (status) => {
            if (status) {
                browserWindow.hide();
            } else if (!browserWindow.isVisible()) {
                isGameStarted = false;

                browserWindow.show();
            }
        });
    }
}, 5000);


/*
* User Preference
*/
ipcMain.on('save-user-preference', (event, data) => {
    fs.writeFileSync(userPreferencePath, data);
});

ipcMain.handle('load-user-preference', (event) => {
    return new Promise((resolve, reject) => {
        let data = null;
        if (fs.existsSync(userPreferencePath)) {
            data = fs.readFileSync(userPreferencePath, { encoding: 'utf8' });
        }

        resolve(data);
    });
});

ipcMain.handle('check-game-folder-path', (event) => {
    return new Promise((resolve, reject) => {
        let data = null;
        if (fs.existsSync(userPreferencePath)) {
            data = fs.readFileSync(userPreferencePath, { encoding: 'utf8' });
        }

        resolve(data);
    });
});

ipcMain.on('set-game-folder', (event, data) => {
    initGameFolder(data);
});

ipcMain.handle('change-game-folder', (event, serverName) => {
    return new Promise(async (resolve, reject) => {
        let newPath = await getNewGamePath();
        if (!newPath) {
            return resolve(null);
        }

        console.log(`Selected new game folder: (${newPath})`);

        initGameFolder(newPath);

        resolve(newPath);
    });
});
