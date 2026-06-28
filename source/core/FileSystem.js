import { BufferUtils } from "./utils/binary/BufferUtils.js";
import { Base64Utils } from "./utils/binary/Base64Utils.js";
import { ArraybufferUtils } from "./utils/binary/ArraybufferUtils.js";
import { runningOnDesktop } from "./utils/Environment.js";

/**
 * FileSystem is used to read and write files using nunuStudio.
 *
 * Its implements multiple solutions for each method depending on the platform (NodeJS, brower or cordova).
 *
 * Some operations are platform specific and might not work everywhere.
 *
 * @module Files
 * @class FileSystem
 * @static
 */
function FileSystem() { }

try
{
	FileSystem.fs = window.require ? window.require("fs") : null;
}
catch(e) { }

/**
 * Check if a file corresponds to a remote location.
 *
 * @method isLocalFile
 * @return {boolean} If the file is remote returns true, false otherwise.
 */
FileSystem.isLocalFile = function (url)
{
	return !(url.startsWith("http") || url.startsWith("blob") || url.startsWith("data"));
};

/**
 * Read a local or remote file as text data.
 *
 * When running on desktop uses nodejs to access files, on the web performs a http GET request.
 *
 * @method readFile
 * @param {string} fname Path or URL of the file being read.
 * @param {boolean} sync If true the file will be read in sync.
 * @param {Function} onLoad onLoad callback receives the read data as parameter.
 * @param {Function} onProgress onProgress callback used to check the file reading progress.
 * @param {Function} onError onError call is called when a error occurs while reading the file.
 * @return {string} File text, or null if the request is async.
 */
FileSystem.readFile = async function (fname, sync, onLoad, onProgress, onError)
{
	// NodeJS Environment
	if(FileSystem.fs && FileSystem.isLocalFile(fname))
	{
		return new Promise(function (resolve)
		{
			FileSystem.fs.readFile(fname, "utf8", function (error, data)
			{
				if(error !== null)
				{
					if(onError !== undefined)
					{
						onError(error);
					}
					resolve(null);
				}
				else
				{
					if(onLoad !== undefined)
					{
						onLoad(data);
					}
					resolve(data);
				}
			});
		});
	}
	// Browser Environment
	else
	{
		try
		{
			const response = await fetch(fname);

			if(!response.ok)
			{
				throw new Error("HTTP error! status: " + response.status);
			}

			let text = "";

			// If no progress tracking is needed, read text directly
			if(onProgress === undefined)
			{
				text = await response.text();
			}
			else
			{
				// Progress tracking implementation using streams
				const contentLength = response.headers.get("content-length");
				const total = contentLength ? parseInt(contentLength, 10) : 0;
				let loaded = 0;

				const reader = response.body.getReader();
				const chunks = [];

				while(true)
				{
					const result = await reader.read();

					if(result.done)
					{
						break;
					}

					chunks.push(result.value);
					loaded += result.value.length;

					onProgress({
						lengthComputable: total !== 0,
						loaded: loaded,
						total: total
					});
				}

				// Combine chunks into a single string representation
				const blob = new Blob(chunks);
				text = await blob.text();
			}

			if(onLoad !== undefined)
			{
				onLoad(text);
			}

			return text;
		}
		catch(error)
		{
			if(onError !== undefined)
			{
				onError(error);
			}
			return null;
		}
	}
};

/**
 * Read a local or remote file as arraybuffer data.
 *
 * When running on desktop uses nodejs to access files, on the web performs a http GET request.
 *
 * @method readFileArrayBuffer
 * @param {string} fname Path or URL of the file being read.
 * @param {boolean} sync If true the file will be read in sync.
 * @param {Function} onLoad onLoad callback receives the read data as parameter.
 * @param {Function} onProgress onProgress callback used to check the file reading progress.
 * @param {Function} onError onError call is called when a error occurs while reading the file.
 * @return {ArrayBuffer} File data as array buffer, or null if the request is async.
 */
FileSystem.readFileArrayBuffer = async function (fname, sync, onLoad, onProgress, onError)
{
	// NodeJS Environment
	if(FileSystem.fs && FileSystem.isLocalFile(fname))
	{
		return new Promise(function (resolve)
		{
			FileSystem.fs.readFile(fname, function (error, buffer)
			{
				if(error !== null)
				{
					if(onError !== undefined)
					{
						onError(error);
					}
					resolve(null);
				}
				else
				{
					var arrayBuffer = ArraybufferUtils.fromBuffer(buffer);
					if(onLoad !== undefined)
					{
						onLoad(arrayBuffer);
					}
					resolve(arrayBuffer);
				}
			});
		});
	}
	// Browser Environment
	else
	{
		try
		{
			const response = await fetch(fname);

			if(!response.ok)
			{
				throw new Error("HTTP error! status: " + response.status);
			}

			let buffer;

			// If no progress tracking is needed, read the buffer directly
			if(onProgress === undefined)
			{
				buffer = await response.arrayBuffer();
			}
			else
			{
				// Progress tracking implementation using streams
				const contentLength = response.headers.get("content-length");
				const total = contentLength ? parseInt(contentLength, 10) : 0;
				let loaded = 0;

				const reader = response.body.getReader();
				const chunks = [];

				while(true)
				{
					const result = await reader.read();

					if(result.done)
					{
						break;
					}

					chunks.push(result.value);
					loaded += result.value.length;

					onProgress({
						lengthComputable: total !== 0,
						loaded: loaded,
						total: total
					});
				}

				// Combine chunks into a single ArrayBuffer
				const blob = new Blob(chunks);
				buffer = await blob.arrayBuffer();
			}

			// Route through utility to preserve your binary-to-string format expectations if necessary
			var finalData = ArraybufferUtils.fromBinaryString(buffer);

			if(onLoad !== undefined)
			{
				onLoad(finalData);
			}

			return finalData;
		}
		catch(error)
		{
			if(onError !== undefined)
			{
				onError(error);
			}
			return null;
		}
	}
};

/**
 * Read a local or remote file as base64 data.
 *
 * When running on desktop uses nodejs to access files, on the web performs a http GET request.
 *
 * @method readFileBase64
 * @param {string} fname Path or URL of the file being read.
 * @param {boolean} sync If true the file will be read in sync.
 * @param {Function} onLoad onLoad callback receives the read data as parameter.
 * @param {Function} onProgress onProgress callback used to check the file reading progress.
 * @param {Function} onError onError call is called when a error occurs while reading the file.
 * @return {string} File data as base64, or null if the request is async.
 */
FileSystem.readFileBase64 = async function (fname, sync, onLoad, onProgress, onError)
{
	// NodeJS Environment
	if(FileSystem.fs && FileSystem.isLocalFile(fname))
	{
		return new Promise(function (resolve)
		{
			FileSystem.fs.readFile(fname, function (error, buffer)
			{
				if(error !== null)
				{
					if(onError !== undefined)
					{
						onError(error);
					}
					resolve(null);
				}
				else
				{
					// Convert buffer to Base64 string cleanly without using deprecated new Buffer constructor
					var base64String = buffer.toString("base64");
					if(onLoad !== undefined)
					{
						onLoad(base64String);
					}
					resolve(base64String);
				}
			});
		});
	}
	// Browser Environment
	else
	{
		try
		{
			const response = await fetch(fname);

			if(!response.ok)
			{
				throw new Error("HTTP error! status: " + response.status);
			}

			let buffer;

			// If no progress tracking is needed, read the buffer directly
			if(onProgress === undefined)
			{
				buffer = await response.arrayBuffer();
			}
			else
			{
				// Progress tracking implementation using streams
				const contentLength = response.headers.get("content-length");
				const total = contentLength ? parseInt(contentLength, 10) : 0;
				let loaded = 0;

				const reader = response.body.getReader();
				const chunks = [];

				while(true)
				{
					const result = await reader.read();

					if(result.done)
					{
						break;
					}

					chunks.push(result.value);
					loaded += result.value.length;

					onProgress({
						lengthComputable: total !== 0,
						loaded: loaded,
						total: total
					});
				}

				// Combine chunks into a single ArrayBuffer
				const blob = new Blob(chunks);
				buffer = await blob.arrayBuffer();
			}

			// Convert array buffer to Base64 using your internal utility pipeline
			var base64Data = Base64Utils.fromBinaryString(buffer);

			if(onLoad !== undefined)
			{
				onLoad(base64Data);
			}

			return base64Data;
		}
		catch(error)
		{
			if(onError !== undefined)
			{
				onError(error);
			}
			return null;
		}
	}
};

/**
 * Write text to a file.
 *
 * When running on the web it writes file to a blob and auto downloads it.
 *
 * @method writeFile
 * @param {string} fname Name/path of the file to write.
 * @param {string} data Text to be written to the file.
 * @param {boolean} sync If true the file is written syncronously. (Only available for Nodejs).
 * @param {Function} onFinish Callback function called when the file is written.
 */
FileSystem.writeFile = function (fname, data, sync, onFinish)
{
	if(FileSystem.fs)
	{
		if(FileSystem.fs.writeFileSync !== undefined)
		{
			if(sync !== false)
			{
				FileSystem.fs.writeFileSync(fname, data, "utf8");
				if(onFinish !== undefined)
				{
					onFinish();
				}
			}
			else
			{
				FileSystem.fs.writeFile(fname, data, "utf8", onFinish);
			}
		}
		else
		{
			var stream = FileSystem.fs.createWriteStream(fname, "utf8");
			stream.write(data);
			stream.end();
		}
	}
	else
	{
		var blob = new Blob([data], { type: "octet/stream" });

		var download = document.createElement("a");
		download.download = fname;
		download.href = window.URL.createObjectURL(blob);
		download.style.display = "none";
		download.onclick = function ()
		{
			document.body.removeChild(this);
		};
		document.body.appendChild(download);
		download.click();

		if(onFinish !== undefined)
		{
			onFinish();
		}
	}
};

/**
 * Write binary file using base64 data.
 *
 * If running on the web writes the file into a blob and auto downloads it.
 *
 * @method writeFileBase64
 * @param {string} fname Name/path of the file to write.
 * @param {string} data Base64 data to be written into the file.
 * @param {boolean} sync If true the file is written syncronously. (Only available for Nodejs)
 * @param {Function} onFinish Callback function called when the file is written.
 */
FileSystem.writeFileBase64 = function (fname, data, sync, onFinish)
{
	if(FileSystem.fs)
	{
		var buffer = Buffer.from(Base64Utils.removeHeader(data), "base64");

		if(FileSystem.fs.writeFile !== undefined)
		{
			if(sync !== false)
			{
				FileSystem.fs.writeFileSync(fname, buffer);

				if(onFinish !== undefined)
				{
					onFinish();
				}
			}
			else
			{
				FileSystem.fs.writeFile(fname, buffer, onFinish);
			}
		}
		else
		{
			var stream = FileSystem.fs.createWriteStream(fname);
			stream.write(buffer);
			stream.end();
		}
	}
	else
	{
		var array = ArraybufferUtils.fromBase64(Base64Utils.removeHeader(data));
		var blob = new Blob([array]);

		var download = document.createElement("a");
		download.download = fname;
		download.href = window.URL.createObjectURL(blob);
		download.onclick = function ()
		{
			document.body.removeChild(this);
		};
		download.style.display = "none";
		document.body.appendChild(download);
		download.click();

		if(onFinish !== undefined)
		{
			onFinish();
		}
	}
};

/**
 * Write binary file using arraybuffer data.
 *
 * If running on the web writes the file into a blob and auto downloads it.
 *
 * @method writeFileArrayBuffer
 * @param {string} fname Name/path of the file to write.
 * @param {string} data Arraybuffer data to be written into the file.
 * @param {boolean} sync If true the file is written syncronously. (Only available for Nodejs)
 * @param {Function} onFinish Callback function called when the file is written.
 */
FileSystem.writeFileArrayBuffer = function (fname, data, sync, onFinish)
{
	if(FileSystem.fs)
	{
		var buffer = BufferUtils.fromArrayBuffer(data);

		if(FileSystem.fs.writeFileSync !== undefined)
		{
			if(sync !== false)
			{
				FileSystem.fs.writeFileSync(fname, buffer);

				if(onFinish !== undefined)
				{
					onFinish();
				}
			}
			else
			{
				FileSystem.fs.writeFile(fname, buffer, onFinish);
			}
		}
		else
		{
			var stream = FileSystem.fs.createWriteStream(fname);
			stream.write(buffer);
			stream.end();
		}
	}
	else
	{
		var blob = new Blob([data]);

		var download = document.createElement("a");
		download.download = fname;
		download.href = window.URL.createObjectURL(blob);
		download.onclick = function ()
		{
			document.body.removeChild(this);
		};
		download.style.display = "none";
		document.body.appendChild(download);
		download.click();

		if(onFinish !== undefined)
		{
			onFinish();
		}
	}
};

/**
 * Choose a file path/name to create a new file and write it to the system.
 *
 * Depending on the platform opens a file path selection windows of a box to select the name of the file.
 *
 * @method chooseFileWrite
 * @param {Function} onLoad onLoad callback that receives the path select to write the file.
 * @param {string} filter File type filter (e.g. ".zip,.rar").
 */
FileSystem.chooseFileWrite = function (onLoad, filter)
{
	if(runningOnDesktop())
	{
		FileSystem.chooseFile(function (files)
		{
			if(files.length > 0)
			{
				onLoad(files[0].path);
			}
		}, filter, true);
	}
	else
	{
		FileSystem.chooseFileName(function (fname)
		{
			onLoad(fname);
		}, filter);
	}
};

/**
 * Open file chooser dialog window for the user to select a directory.
 *
 * Only works while using NWJS.
 *
 * @method chooseDirectory
 * @return {Promise<string>} Promise that resolves with the selected path.
 */
FileSystem.chooseDirectory = function ()
{
	return new Promise(function (resolve, reject)
	{
		var chooser = document.createElement("input");
		chooser.type = "file";
		chooser.style.display = "none";
		chooser.nwdirectory = true;
		document.body.appendChild(chooser);

		chooser.onchange = function ()
		{
			resolve(chooser.value);
			document.body.removeChild(chooser);
		};

		chooser.onerror = reject;
		chooser.onabort = reject;

		chooser.click();
	});

};

/**
 * Open file chooser dialog window for the user to select files stored in the system.
 *
 * The files selected are retrieved using the onLoad callback that receives a array of File objects.
 *
 * @method chooseFile
 * @param {Function} onLoad onLoad callback that receives array of files as parameter.
 * @param {string} filter File type filter (e.g. .zip, .rar).
 * @param {string} saveas File format or name to be used, optinonally it can be a boolean value indicating savemode.
 * @param {boolean} multiFile If true the chooser will accept multiple files.
 */
FileSystem.chooseFile = function (onLoad, filter, saveas, multiFile)
{
	var chooser = document.createElement("input");
	chooser.type = "file";
	chooser.style.display = "none";
	document.body.appendChild(chooser);

	if(filter !== undefined)
	{
		chooser.accept = filter;
	}

	if(multiFile === true)
	{
		chooser.multiple = true;
	}

	chooser.onchange = function ()
	{
		if(onLoad !== undefined)
		{
			onLoad(chooser.files);
		}

		document.body.removeChild(chooser);
	};

	if(saveas !== undefined)
	{
		chooser.nwsaveas = saveas !== true ? saveas : "file";
	}

	chooser.click();
};

/**
 * Used as an alternative to chooseFile for saving files in the browser.
 *
 * Uses a prompt to question the user the file name.
 *
 * @method chooseFileName
 * @param {Function} onLoad onLoad callback
 * @param {string} saveas File extension
 */
FileSystem.chooseFileName = function (onLoad, saveas, name)
{
	var fname = prompt("Save As", name !== undefined ? name : "file");

	if(fname !== null)
	{
		if(saveas !== undefined && !fname.endsWith(saveas))
		{
			fname += saveas;
		}

		if(onLoad !== undefined)
		{
			onLoad(fname);
		}
	}
};

/**
 * Copy file (cannot be used to copy folders).
 *
 * Only works when running inside NWJS.
 *
 * @method copyFile
 * @param {string} src
 * @param {string} dst
 */
FileSystem.copyFile = function (src, dst)
{
	if(FileSystem.fs)
	{
		if(FileSystem.fs.copyFileSync !== undefined)
		{
			FileSystem.fs.copyFileSync(src, dst);
		}
		else
		{
			src.replace(new RegExp("/", 'g'), "\\");
			dst.replace(new RegExp("/", 'g'), "\\");

			FileSystem.fs.createReadStream(src).pipe(FileSystem.fs.createWriteStream(dst));
		}
	}
};

/**
 * Make a directory (dont throw exeption if directory already exists).
 *
 * Only works when running inside NWJS.
 *
 * @method makeDirectory
 * @param {string} dir
 */
FileSystem.makeDirectory = function (dir)
{
	if(FileSystem.fs)
	{
		dir.replace(new RegExp("/", 'g'), "\\");
		FileSystem.fs.mkdirSync(dir, { recursive: true });
	}
};

/**
 * Returns files in directory (returns empty array in case of error).
 *
 * Only works when running inside NWJS.
 *
 * @method getFilesDirectory
 * @return {Array} Files in the directory
 */
FileSystem.getFilesDirectory = function (dir)
{
	if(FileSystem.fs)
	{
		try
		{
			dir.replace(new RegExp("/", 'g'), "\\");
			return FileSystem.fs.readdirSync(dir);
		}
		catch(e)
		{
			return [];
		}
	}

	return [];
};

/**
 * Delete folders and all subfolders.
 *
 * Only works when running inside NWJS.
 *
 * @method deleteFolder
 * @param {string} path
 */
FileSystem.deleteFolder = function (path)
{
	if(FileSystem.fs)
	{
		if(FileSystem.fs.existsSync(path))
		{
			FileSystem.fs.readdirSync(path).forEach(function (file)
			{
				var curPath = path + "/" + file;

				if(FileSystem.fs.lstatSync(curPath).isDirectory())
				{
					FileSystem.deleteFolder(curPath);
				}
				else
				{
					FileSystem.fs.unlinkSync(curPath);
				}
			});

			FileSystem.fs.rmdirSync(path);
		}
	}
};

/**
 * Copy folder and all its files (includes symbolic links).
 *
 * Only works when running inside NWJS.
 *
 * @method copyFolder
 * @param {string} src
 * @param {string} dst
 */
FileSystem.copyFolder = function (src, dst)
{
	if(FileSystem.fs)
	{
		src.replace(new RegExp("/", 'g'), "\\");
		dst.replace(new RegExp("/", 'g'), "\\");

		FileSystem.makeDirectory(dst);
		var files = FileSystem.fs.readdirSync(src);

		for(var i = 0; i < files.length; i++)
		{
			var source = src + "\\" + files[i];
			var destiny = dst + "\\" + files[i];
			var current = FileSystem.fs.statSync(source);

			// Directory
			if(current.isDirectory())
			{
				FileSystem.copyFolder(source, destiny);
			}
			// Symbolic link
			else if(current.isSymbolicLink())
			{
				FileSystem.fs.symlinkSync(FileSystem.fs.readlinkSync(source), destiny);
			}
			// File
			else
			{
				FileSystem.copyFile(source, destiny);
			}
		}
	}
};

/**
 * Check if a file exists.
 *
 * Only works inside of NWJS. When running inside the browser always returns false.
 *
 * @method fileExists
 * @param {string} file File path
 * @return {boolean} True is file exists
 */
FileSystem.fileExists = function (file)
{
	if(FileSystem.fs)
	{
		file.replace(new RegExp("/", 'g'), "\\");

		return FileSystem.fs.existsSync(file);
	}

	return false;
};

/**
 * Get file name without extension from file path string.
 *
 * If input is a/b/c/abc.d output is abc.
 *
 * @method getFileName
 * @param {string} file File path
 * @return {string} File name without path and extension
 */
FileSystem.getFileName = function (file)
{
	if(file !== undefined)
	{
		if(file instanceof File)
		{
			file = file.name;
		}

		var a = file.lastIndexOf("\\");
		var b = file.lastIndexOf("/");

		return file.substring(a > b ? a + 1 : b + 1, file.lastIndexOf("."));
	}

	return "";
};

/**
 * Get file name with extension from file path string.
 *
 * If input is a/b/c/abc.d output is abc.d.
 *
 * @method getFileNameWithExtension
 * @param {string} file File path
 * @return {string} File name without path with extension
 */
FileSystem.getFileNameWithExtension = function (file)
{
	if(file !== undefined)
	{
		if(file instanceof File)
		{
			file = file.name;
		}

		var a = file.lastIndexOf("\\");
		var b = file.lastIndexOf("/");

		return file.substring(a > b ? a + 1 : b + 1, file.length);
	}

	return "";
};

/**
 * Get file name without extension.
 *
 * If input is a/b/c/abc.d output is a/b/c/abc.
 *
 * @method getNameWithoutExtension
 * @param {string} file File path
 * @return {string}
 */
FileSystem.getNameWithoutExtension = function (file)
{
	if(file !== undefined)
	{
		if(file instanceof File)
		{
			file = file.name;
		}

		return file.substring(0, file.lastIndexOf("."));
	}

	return "";
};

/**
 * Get directory where the file is placed.
 *
 * If input is a/b/c/abc.d output is a/b/c/
 *
 * @method getFilePath
 * @param {string} file File path
 * @return {string}
 */
FileSystem.getFilePath = function (file)
{
	if(file !== undefined)
	{
		if(file instanceof File)
		{
			file = file.name;
		}

		var a = file.lastIndexOf("\\");
		var b = file.lastIndexOf("/");

		return file.substring(0, a > b ? a + 1 : b + 1);
	}

	return "";
};

/**
 * Get file extension from file path string (always in lowercase).
 *
 * If input is a/b/c/abc.d output is d.
 *
 * @method getFileExtension
 * @param {string} file File path
 * @return {string}
 */
FileSystem.getFileExtension = function (file)
{
	if(file !== undefined)
	{
		if(file instanceof File)
		{
			file = file.name;
		}

		return file.substring(file.lastIndexOf(".") + 1, file.length).toLowerCase();
	}

	return "";
};

export { FileSystem };
