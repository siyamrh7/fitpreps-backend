// controllers/siteSettingsController.js
const { getDB } = require('../config/db');

// Get all site settings
exports.getAllSettings = async (req, res) => {
  try {
    const settingsCollection = getDB().collection('site_settings');
    const settings = await settingsCollection.findOne({ _id: 'general' });
    
    if (!settings) {
      // Return default settings if none exist
      return res.status(200).json({
        heroTitle: 'Fit Preps Sportmaaltijden: <br />Gemaakt om te presteren',
      });
    }
    
    res.status(200).json({
      heroTitle: settings.heroTitle || 'Fit Preps Sportmaaltijden: <br />Gemaakt om te presteren',
    });
  } catch (error) {
    console.error('Error fetching site settings:', error);
    res.status(500).json({ message: 'Error fetching site settings', error: error.message });
  }
};

// Update site settings
exports.updateSettings = async (req, res) => {
  try {
    const { heroTitle } = req.body;
    
    if (!heroTitle) {
      return res.status(400).json({ 
        message: 'Hero title is required'
      });
    }
    
    const settingsCollection = getDB().collection('site_settings');
    
    // Use upsert to create or update
    const result = await settingsCollection.updateOne(
      { _id: 'general' },
      { 
        $set: { 
          heroTitle,
          updatedAt: new Date()
        },
        $setOnInsert: {
          _id: 'general',
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    // Fetch the updated document
    const settings = await settingsCollection.findOne({ _id: 'general' });
    
    res.status(200).json({ 
      message: 'Settings updated successfully',
      settings: {
        heroTitle: settings.heroTitle
      }
    });
  } catch (error) {
    console.error('Error updating site settings:', error);
    res.status(500).json({ message: 'Error updating site settings', error: error.message });
  }
};

