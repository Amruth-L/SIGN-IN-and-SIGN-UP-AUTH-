/**
 * Reusable Razorpay Payment Service helper
 */

const RAZORPAY_TEST_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TJCbHTYQTsOUNU';

/**
 * Check if a key is a valid Razorpay key (not a simulation placeholder)
 */
const isValidRazorpayKey = (key) => {
  return key && key !== 'SIMULATION_MODE' && key !== 'SIMULATION' && key !== 'dummy_key';
};

export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const timeout = setTimeout(() => {
      resolve(false);
    }, 6000); // 6 second safety timeout
    
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    script.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

export const openRazorpayCheckout = async ({
  key,
  amount,
  currency = 'INR',
  name = 'CampusMesh',
  description,
  order_id,
  prefill = {},
  handler,
  modalDismissHandler
}) => {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
  }

  // Always use a valid Razorpay key — never pass simulation placeholders to the SDK
  const resolvedKey = isValidRazorpayKey(key) ? key : RAZORPAY_TEST_KEY;

  const options = {
    key: resolvedKey,
    amount: Math.round(parseFloat(amount) * 100), // convert to paise
    currency,
    name: name || 'CampusMesh',
    description: description || 'CampusMesh Student Rentals',
    image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    prefill: {
      name: prefill.name || '',
      email: prefill.email || '',
      contact: prefill.phone_number || ''
    },
    theme: {
      color: '#10b981' // CampusMesh Emerald Green theme
    },
    handler: (response) => {
      // Signature is returned here on success
      if (handler) {
        handler({
          gateway_order_id: response.razorpay_order_id,
          gateway_payment_id: response.razorpay_payment_id,
          gateway_signature: response.razorpay_signature
        });
      }
    },
    modal: {
      ondismiss: () => {
        if (modalDismissHandler) {
          modalDismissHandler();
        }
      }
    }
  };

  // Only pass order_id if it's a real Razorpay order (not a simulated one)
  if (order_id && !order_id.startsWith('sim_')) {
    options.order_id = order_id;
  }

  const rzp = new window.Razorpay(options);

  // Capture payment failures and surface them
  rzp.on('payment.failed', (response) => {
    console.error('[Razorpay] Payment failed:', response.error);
    if (modalDismissHandler) {
      modalDismissHandler(response.error);
    }
  });

  rzp.open();
};
