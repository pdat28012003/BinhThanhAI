// migrate-data.js - Script để cập nhật dữ liệu cũ trong MongoDB
require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ MongoDB Connected');
    migrateData();
})
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
});

// Schema (with new fields)
const ChatDataSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    fileType: { type: String, enum: ['text', 'word'], default: 'text' },
    htmlContent: { type: String, default: null },
    imageCount: { type: Number, default: 0 },
    date: { type: String },
    createdAt: { type: Date }
});

const ChatData = mongoose.model('ChatData', ChatDataSchema);

async function migrateData() {
    try {
        console.log('\n🔄 Starting data migration...\n');
        
        // Find all documents
        const allData = await ChatData.find();
        console.log(`📊 Found ${allData.length} documents in database\n`);
        
        let migratedCount = 0;
        
        for (const doc of allData) {
            // Check if document needs migration
            if (!doc.fileType) {
                // Update document with default values
                doc.fileType = 'text';
                doc.htmlContent = null;
                doc.imageCount = 0;
                
                await doc.save();
                migratedCount++;
                
                console.log(`✅ Migrated: "${doc.title}"`);
            } else {
                console.log(`⏭️  Skipped (already migrated): "${doc.title}"`);
            }
        }
        
        console.log(`\n╔════════════════════════════════════════╗`);
        console.log(`║     Migration Completed                ║`);
        console.log(`╚════════════════════════════════════════╝`);
        console.log(`📊 Total documents: ${allData.length}`);
        console.log(`✅ Migrated: ${migratedCount}`);
        console.log(`⏭️  Already migrated: ${allData.length - migratedCount}\n`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
}
