const multer = require("multer");
const path = require("path");


const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dest = path.join(__dirname, '..', 'images');
        // Ensure destination directory exists
        fs.mkdir(dest, { recursive: true }, (err) => {
            if (err) return cb(err);
            // Use relative path (images) for saved file.path so our DB normalization works
            cb(null, dest);
        });
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        let baseName = path.parse(file.originalname).name.replace(/\\/g, '/');
        cb(null, baseName + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        let ext = path.extname(file.originalname).toLowerCase();
        if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
            cb(new Error("Unsupported file type!"), false);
            return;
        }
        cb(null, true);
    },
});

module.exports = {
    single: upload.single.bind(upload),
    array: upload.array.bind(upload),
    upload
};