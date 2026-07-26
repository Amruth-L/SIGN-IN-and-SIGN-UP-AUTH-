const profileService = require('../services/profileService');

/**
 * Helper to validate profile input fields.
 * Supports both full validation (creation) and partial validation (updates).
 */
const validateProfile = (data, isUpdate = false) => {
  const errors = [];
  const { full_name, phone, department, semester, bio } = data;

  if (isUpdate) {
    if (full_name !== undefined && (!full_name || typeof full_name !== 'string' || !full_name.trim())) {
      errors.push('full_name is required and cannot be empty.');
    }
    if (phone !== undefined && (!phone || typeof phone !== 'string' || !phone.trim())) {
      errors.push('phone is required and cannot be empty.');
    }
    if (department !== undefined && (!department || typeof department !== 'string' || !department.trim())) {
      errors.push('department is required and cannot be empty.');
    }
    if (semester !== undefined && (semester === null || semester === '' || isNaN(Number(semester)) || !Number.isInteger(Number(semester)))) {
      errors.push('semester must be an integer.');
    }
    if (bio !== undefined && bio !== null && bio.length > 300) {
      errors.push('bio cannot exceed 300 characters.');
    }
  } else {
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      errors.push('full_name is required.');
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      errors.push('phone is required.');
    }
    if (!department || typeof department !== 'string' || !department.trim()) {
      errors.push('department is required.');
    }
    if (semester === undefined || semester === null || semester === '' || isNaN(Number(semester)) || !Number.isInteger(Number(semester))) {
      errors.push('semester is required and must be an integer.');
    }
    if (bio && bio.length > 300) {
      errors.push('bio cannot exceed 300 characters.');
    }
  }

  return errors;
};

/**
 * Controller class to handle Profile requests.
 */
class ProfileController {
  /**
   * GET /api/profile
   * Fetch active user's profile details.
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.id;
      const profile = await profileService.getProfileByUserId(userId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found.'
        });
      }

      return res.status(200).json({
        success: true,
        profile
      });
    } catch (error) {
      console.error('Error in getProfile:', error.message || error);
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error'
      });
    }
  }

  /**
   * POST /api/profile
   * Create a profile for the authenticated user.
   */
  async createProfile(req, res) {
    try {
      const userId = req.user.id;

      // 1. Check if profile already exists (limit: 1 profile per user)
      const existingProfile = await profileService.getProfileByUserId(userId);
      if (existingProfile) {
        return res.status(409).json({
          success: false,
          message: 'Profile already exists for this user.'
        });
      }

      // 2. Validate request body
      const validationErrors = validateProfile(req.body, false);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: validationErrors
        });
      }

      // 3. Destructure and prepare insert payload
      const { full_name, phone, department, semester, hostel, bio, avatar_url } = req.body;
      const profilePayload = {
        user_id: userId,
        full_name: full_name.trim(),
        phone: phone.trim(),
        department: department.trim(),
        semester: parseInt(semester, 10),
        hostel: hostel ? hostel.trim() : null,
        bio: bio ? bio.trim() : null,
        avatar_url: avatar_url ? avatar_url.trim() : null,
        mesh_score: 100, // Default mesh score
        verified: false  // Default verified status
      };

      // 4. Save to database via service
      const newProfile = await profileService.createProfile(profilePayload);

      return res.status(201).json({
        success: true,
        message: 'Profile created successfully.',
        profile: newProfile
      });
    } catch (error) {
      console.error('Error in createProfile:', error.message || error);
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error'
      });
    }
  }

  /**
   * PUT /api/profile
   * Update the authenticated user's profile.
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;

      // 1. Ensure profile exists first
      const existingProfile = await profileService.getProfileByUserId(userId);
      if (!existingProfile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found. Create a profile first.'
        });
      }

      // 2. Validate fields if they are supplied (partial update validation)
      const validationErrors = validateProfile(req.body, true);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: validationErrors
        });
      }

      // 3. Extract and filter fields that can be updated
      const updatableFields = ['full_name', 'phone', 'department', 'semester', 'hostel', 'bio', 'avatar_url'];
      const updatePayload = {};

      updatableFields.forEach(field => {
        if (req.body[field] !== undefined) {
          if (field === 'semester') {
            updatePayload[field] = parseInt(req.body[field], 10);
          } else {
            updatePayload[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
          }
        }
      });

      // If no valid fields are provided to update, skip service call
      if (Object.keys(updatePayload).length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No changes provided.',
          profile: existingProfile
        });
      }

      // 4. Call service to perform update
      const updatedProfile = await profileService.updateProfile(userId, updatePayload);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        profile: updatedProfile
      });
    } catch (error) {
      console.error('Error in updateProfile:', error.message || error);
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error'
      });
    }
  }
}

module.exports = new ProfileController();
