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

const initPaths = () => {
    const userDataPath = (app || remote).getPath('userData');

    userPreferencePath = path.join(userDataPath, 'user-preference.json');
    gameFolderPath = path.join(userDataPath, 'Servers');
    defaultGameFolderPath = gameFolderPath;

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

initPaths();

app.commandLine.appendSwitch("disable-http-cache");
app.whenReady().then(createWindow)

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

    if (!result) {
        browserWindow.webContents.send('check-for-updates-result', null);

        return;
    }

    browserWindow.webContents.send('check-for-updates-result', JSON.stringify(result.updateInfo));
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

                   console.log(path.replace(`${getGameFolder(serverName)}/`, ""));

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

ipcMain.on('openLogFolder', () => {
    shell.openPath(path.join(process.env.APPDATA, '../Local/Temp/IronGate/Valheim/Crashes'));
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

ipcMain.on('set-game-folder', (event, data) => {
    initGameFolder(data);
});

ipcMain.handle('change-game-folder', (event, serverName) => {
    return new Promise(async (resolve, reject) => {
        const result = await dialog.showOpenDialog(browserWindow, {
            defaultPath: defaultGameFolderPath,
            properties: ['openDirectory']
        });

        if (result.canceled) {
            return resolve(null);
        }

        let newPath = result.filePaths[0];

        copyFolderRecursiveSync(prevGameFolderPath, newPath);

        newPath = path.join(newPath, 'Servers');

        initGameFolder(newPath);

        resolve(newPath);
    });
});

const copyFileSync = (source,target) => {
    let targetFile = target;

    if ( fs.existsSync( target ) ) {
        if ( fs.lstatSync( target ).isDirectory() ) {
            targetFile = path.join( target, path.basename( source ) );
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

const copyFolderRecursiveSync = (source, target) => {
    let files = [];

    const targetFolder = path.join( target, path.basename( source ) );
    if ( !fs.existsSync( targetFolder ) ) {
        fs.mkdirSync( targetFolder );
    }

    if ( fs.lstatSync( source ).isDirectory() ) {
        files = fs.readdirSync( source );
        files.forEach( function ( file ) {
            var curSource = path.join( source, file );
            if ( fs.lstatSync( curSource ).isDirectory() ) {
                copyFolderRecursiveSync( curSource, targetFolder );
            } else {
                copyFileSync( curSource, targetFolder );
            }
        } );
    }
}

const getGameFolder = (serverName) => {
    return path.join(gameFolderPath, serverName);
}

const createGameFolder = (serverName) => {
    const gamePath = path.join(gameFolderPath, serverName);

    if (!fs.existsSync(gamePath)) {
        fs.mkdirSync(gamePath);
    }
}
