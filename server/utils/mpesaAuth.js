const axios = require('axios');

class MpesaAuth {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.baseURL = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';
    
    // Cache for access token
    this.tokenCache = {
      token: null,
      expiresAt: null
    };
  }

  /**
   * Generate Basic Auth credentials
   */
  getBasicAuthCredentials() {
    const credentials = `${this.consumerKey}:${this.consumerSecret}`;
    return Buffer.from(credentials).toString('base64');
  }

  /**
   * Get OAuth access token (with caching)
   */
  async getAccessToken() {
    try {
      // Check if we have a valid cached token
      if (this.tokenCache.token && this.tokenCache.expiresAt > Date.now()) {
        console.log('🔄 Using cached M-Pesa access token');
        return this.tokenCache.token;
      }

      console.log('🔑 Requesting new M-Pesa access token...');
      
      const credentials = this.getBasicAuthCredentials();
      
      const response = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const { access_token, expires_in } = response.data;
      
      // Cache the token (subtract 60 seconds for safety margin)
      this.tokenCache = {
        token: access_token,
        expiresAt: Date.now() + ((expires_in - 60) * 1000)
      };

      console.log('✅ M-Pesa access token obtained successfully');
      return access_token;

    } catch (error) {
      console.error('❌ Failed to get M-Pesa access token:', error.response?.data || error.message);
      throw new Error(`M-Pesa OAuth failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Generate Security Credential for B2C (not needed for sandbox, but included for completeness)
   */
  generateSecurityCredential() {
    // In sandbox, this is usually a simple string
    // In production, you'd encrypt the initiator password with Safaricom's public key
    return process.env.MPESA_SECURITY_CREDENTIAL || 'Safaricom999!*!';
  }

  /**
   * Generate password for STK Push (not used in C2B/B2C but useful for future)
   */
  generatePassword() {
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const timestamp = this.getTimestamp();
    
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  /**
   * Generate timestamp in the required format
   */
  getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Format phone number to required format (254XXXXXXXXX)
   */
  formatPhoneNumber(phone) {
    // Remove any spaces, hyphens, or plus signs
    phone = phone.replace(/[\s\-\+]/g, '');
    
    // Handle different formats
    if (phone.startsWith('0')) {
      // Convert 0712345678 to 254712345678
      return `254${phone.substring(1)}`;
    } else if (phone.startsWith('254')) {
      // Already in correct format
      return phone;
    } else if (phone.startsWith('7') || phone.startsWith('1')) {
      // Handle 712345678 or 112345678
      return `254${phone}`;
    }
    
    throw new Error('Invalid phone number format. Use format: 0712345678, 254712345678, or 712345678');
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(phone) {
    const kenyanPhoneRegex = /^254[71]\d{8}$/;
    const formattedPhone = this.formatPhoneNumber(phone);
    
    if (!kenyanPhoneRegex.test(formattedPhone)) {
      throw new Error('Invalid Kenyan phone number. Must be Safaricom (07xx) or Airtel (01xx)');
    }
    
    return formattedPhone;
  }
}

// Export singleton instance
module.exports = new MpesaAuth();