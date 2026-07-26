const supabase = require('../config/supabase');

/**
 * Service to handle Supabase database operations for profiles.
 */
class ProfileService {
  /**
   * Fetch a user profile by their auth user ID.
   * @param {string} userId - Auth User ID (UUID)
   * @returns {Promise<Object|null>} - Profile object or null if not found
   */
  async getProfileByUserId(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 indicates that no rows were returned for .single()
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Create a new profile in the database.
   * @param {Object} profileData - Profile details to insert
   * @returns {Promise<Object>} - The newly created profile
   */
  async createProfile(profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .insert([profileData])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Update an existing user profile.
   * @param {string} userId - Auth User ID (UUID)
   * @param {Object} updateData - Partial fields to update
   * @returns {Promise<Object>} - The updated profile object
   */
  async updateProfile(userId, updateData) {
    // Add updated_at automatically
    const payload = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}

module.exports = new ProfileService();
