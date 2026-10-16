# Backend Tasks for GlobeVerify Mobile Support

This document tracks backend modifications or new endpoints required to fully support the native iOS and Android apps.

---

## Task 1: Native Push Notification Token Registration

### Context
The web application uses Web Push (VAPID via `/api/push/subscribe`).  
Native iOS (Apple Push Notification service - APNs) and Android (Firebase Cloud Messaging - FCM) generate native Expo Push Tokens (`ExponentPushToken[...]`) via `expo-notifications`.

### Endpoint Contract Proposal

* **Method:** `POST`
* **Route:** `/api/push/device-token`
* **Headers:**  
  * `Authorization: Bearer <jwt_token>`
  * `x-auth-token: <jwt_token>`
* **Request Body:**
  ```json
  {
    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "platform": "ios", // or "android"
    "deviceModel": "iPhone 16,1",
    "appVersion": "1.0.0"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Device push token registered successfully"
  }
  ```

### Handling Unregister / Logout
* **Method:** `DELETE`
* **Route:** `/api/push/device-token`
* **Request Body:**
  ```json
  {
    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  }
  ```

### Server-side Push Notification Dispatch
When an OTP arrives for an active number (`otp_received` event):
```javascript
// In numberService / webhookController:
if (pushTokens.length > 0) {
    await expoPush.send({
        to: pushTokens,
        sound: 'default',
        title: `Your ${serviceName} OTP Code is: ${otpCode}`,
        body: `Tap to open and copy your verification code for ${countryName}.`,
        data: { numberId, code: otpCode }
    });
}
```

---

## Task 2: Cloudflare Turnstile Exemption for Mobile App

### Context
Cloudflare Turnstile is configured on `POST /api/auth/login` and `POST /api/auth/register`.  
Native mobile apps do not have a browser window to run the Turnstile client JS challenge without loading an embedded WebView.

### Options
1. **Option A (Recommended):** Add an internal mobile app HMAC secret header:
   - Header: `x-mobile-app-signature: <computed_signature>` or `x-app-platform: mobile-native`
   - Bypasses Turnstile validation on native mobile requests.
2. **Option B:** Host a lightweight HTML page on `globeverify.com/captcha` that the native app loads inside an invisible 1px WebView to obtain the token.
