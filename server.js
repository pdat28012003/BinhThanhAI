require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '.')));
app.use('/uploads', express.static(uploadDir));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Schema
const ChatDataSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: String, default: () => new Date().toLocaleString('vi-VN') },
    createdAt: { type: Date, default: Date.now }
});

// Carousel Images Schema
const CarouselImageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    alt: { type: String, default: '' },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const ChatData = mongoose.model('ChatData', ChatDataSchema);
const CarouselImage = mongoose.model('CarouselImage', CarouselImageSchema);

// Routes

// Get all data
app.get('/api/data', async (req, res) => {
    try {
        const data = await ChatData.find().sort({ createdAt: -1 });
        // Map _id to id for frontend compatibility
        const formattedData = data.map(item => ({
            id: item._id,
            title: item.title,
            content: item.content,
            date: item.date
        }));
        res.json(formattedData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new data
app.post('/api/data', async (req, res) => {
    try {
        const { title, content } = req.body;
        const newData = new ChatData({ title, content });
        await newData.save();
        res.json({
            id: newData._id,
            title: newData.title,
            content: newData.content,
            date: newData.date
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete data
app.delete('/api/data/:id', async (req, res) => {
    try {
        await ChatData.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get carousel images
app.get('/api/carousel', async (req, res) => {
    try {
        const images = await CarouselImage.find().sort({ order: 1 });
        res.json(images);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add carousel image
app.post('/api/carousel', async (req, res) => {
    try {
        const { title, imageUrl, alt, order } = req.body;
        const newImage = new CarouselImage({ title, imageUrl, alt, order: order || 0 });
        await newImage.save();
        res.json(newImage);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Upload carousel image
app.post('/api/carousel/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const { title, alt, order } = req.body;
        const imageUrl = `/uploads/${req.file.filename}`;

        const newImage = new CarouselImage({
            title: title || 'Untitled',
            imageUrl: imageUrl,
            alt: alt || '',
            order: order || 0
        });

        await newImage.save();
        res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: newImage
        });
    } catch (err) {
        // Clean up uploaded file if DB save fails
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(400).json({ error: err.message });
    }
});

// Upload carousel image with base64
app.post('/api/carousel/upload-base64', async (req, res) => {
    try {
        const { title, imageData, alt, order } = req.body;

        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        // Remove data:image/...;base64, prefix if exists
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const filename = `base64-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
        const filepath = path.join(uploadDir, filename);

        // Write base64 to file
        fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

        const imageUrl = `/uploads/${filename}`;

        const newImage = new CarouselImage({
            title: title || 'Untitled',
            imageUrl: imageUrl,
            alt: alt || '',
            order: order || 0
        });

        await newImage.save();
        res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: newImage
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete carousel image
app.delete('/api/carousel/:id', async (req, res) => {
    try {
        const image = await CarouselImage.findByIdAndDelete(req.params.id);
        
        // Delete image file from server if it exists
        if (image && image.imageUrl && image.imageUrl.startsWith('/uploads/')) {
            const filepath = path.join(__dirname, image.imageUrl);
            fs.unlink(filepath, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend files
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
