const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require("path");
const fs = require('fs')
const isAdmin = require('is-admin');
const exec = require('child_process').execFile;
const glob = require("glob");
const crypto = require('crypto');
const { download } = require('electron-dl');
const { autoUpdater } = require('electron-updater');

require('electron-reload')(`${__dirname}/dist`, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron.cmd')
});

const ps = require('ps-node');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let browserWindow
let isDevBuild = false;
let rootPath = isDevBuild ? __dirname : path.join(app.getPath("exe"), '../');
let isGameStarted = false;

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

    browserWindow.loadFile(path.join(__dirname, '/dist/index.html'));

    browserWindow.on('closed', () => {
        browserWindow = null
    })

    browserWindow.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
}

autoUpdater.on('update-available', () => {
    browserWindow.webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
    browserWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

app.commandLine.appendSwitch("disable-http-cache");

app.whenReady().then(() => {
    createWindow();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

ipcMain.on('close', () => {
    app.quit();
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
       try {
           glob(`${rootPath}/Games/${serverName}/**/*`, { nodir: true }, (err, res) => {
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
                       path: path.replace(`${rootPath}/Games/`, "")
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

ipcMain.handle('delete-all-file', async (e, serverName) => {
   return new Promise((resolve, reject) => {
       try {
           glob(`${rootPath}/Games/${serverName}/**/*`, { nodir: true }, (err, res) => {
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
               directory: `${rootPath}\\Games\\${serverName}\\${storagePath}`,
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
            let url = `${rootPath}/Games/${params.server}/valheim.exe`;

            isGameStarted = true;

            exec(url, params.launchParams, () => { });

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

ipcMain.on('openGameFolder', (e, serverName) => {
    shell.openPath(path.join(rootPath, `/Games/${serverName}`));
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
