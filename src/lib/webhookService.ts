// Webhook service for sending notifications on Firestore changes
const WEBHOOK_URL = 'https://n8n-jowjjemi.ap-southeast-1.clawcloudrun.com/webhook-test/15367c88-2160-46ad-8320-48b85b088858';

export interface WebhookPayload {
  action: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data?: any;
  previousData?: any;
  timestamp: string;
  userId?: string;
  userRole?: string;
  userName?: string;
}

export const sendWebhookNotification = async (payload: WebhookPayload): Promise<void> => {
  try {
    console.log('Webhook - Sending notification:', payload);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        source: 'BeomMed System',
        environment: 'development',
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook - Response error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Webhook failed with status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.text();
    console.log('Webhook - Notification sent successfully:', {
      action: payload.action,
      collection: payload.collection,
      documentId: payload.documentId,
      response: responseData
    });
  } catch (error) {
    console.error('Webhook - Failed to send notification:', {
      error: error.message,
      payload: payload
    });
    // Don't throw error to prevent disrupting main operations
  }
};

export const createWebhookPayload = (
  action: 'create' | 'update' | 'delete',
  collection: string,
  documentId: string,
  data?: any,
  previousData?: any,
  user?: { id: string; role: string; name: string }
): WebhookPayload => {
  return {
    action,
    collection,
    documentId,
    data: data ? sanitizeData(data) : undefined,
    previousData: previousData ? sanitizeData(previousData) : undefined,
    timestamp: new Date().toISOString(),
    userId: user?.id,
    userRole: user?.role,
    userName: user?.name,
  };
};

// Sanitize data to remove sensitive information and convert Firestore types
const sanitizeData = (data: any): any => {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  // Remove sensitive fields
  delete sanitized.password;
  
  // Convert Firestore Timestamps to ISO strings
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] && typeof sanitized[key] === 'object') {
      if (sanitized[key].toDate && typeof sanitized[key].toDate === 'function') {
        sanitized[key] = sanitized[key].toDate().toISOString();
      } else if (sanitized[key] instanceof Date) {
        sanitized[key] = sanitized[key].toISOString();
      }
    }
  });
  
  return sanitized;
};