# Blockchain AEM Login Component

**AEM-inspired login page with biometric authentication**

---

## 🎨 Design

Inspired by Adobe Experience Manager's login aesthetic:
- **Dark background** with animated gradient
- **Semi-transparent login box** (right-aligned, like AEM)
- **Adobe-style logo** in top-right corner
- **Modern glassmorphism** with backdrop blur
- **Smooth animations** and transitions

---

## 🔐 Authentication Methods

### 1. **Biometric Sign-In** (Primary)
- WebAuthn/FIDO2 biometric authentication
- Face ID, Touch ID, or Windows Hello
- Hardware-backed security (Secure Enclave)
- P-256 signatures verified via Oak-Auth-Web3

### 2. **MetaMask Sign-In** (Alternative)
- Traditional Ethereum wallet authentication
- secp256k1 signatures
- Fallback for devices without biometrics

---

## 📁 Structure

```
apps/blockchain-aem/components/login/
├── clientlibs/
│   ├── css/
│   │   └── login-styles.css      # AEM-inspired styling
│   ├── js/
│   │   └── login.js               # Authentication logic
│   ├── css.txt                    # CSS clientlib config
│   └── js.txt                     # JS clientlib config
└── README.md                      # This file

content/blockchain-aem/
└── login.html                     # Login page HTML
```

---

## 🚀 Usage

### Accessing the Login Page

```
http://localhost:4502/content/blockchain-aem/login.html
```

### First-Time Setup

1. **Register biometric** first at oak-chain publisher:
   ```
   http://localhost:4502/content/blockchain-aem/oak-chain-publish.html
   ```

2. Click "🔐 Register Biometric"

3. Scan biometric + sign with MetaMask

4. Return to login page

### Sign In Flow

1. Navigate to login page
2. Click **"Sign In with Biometrics"**
3. Scan biometric (Face ID / Touch ID)
4. ✅ Authenticated → Redirected to dashboard

---

## 🔄 Authentication Flow

### Biometric Flow

```
User clicks "Sign In with Biometrics"
↓
Check biometric availability (WebAuthn)
↓
Get wallet address (localStorage or MetaMask)
↓
Verify biometric registered (check credentialId)
↓
Generate authentication challenge (/j_security_check?biometric_challenge=true)
↓
Trigger biometric prompt (navigator.credentials.get)
↓
User scans biometric
↓
Extract P-256 signature from assertion
↓
Submit to Oak-Auth-Web3 (/j_security_check POST)
↓
Oak verifies P-256 signature (LocalP256Verifier)
↓
JAAS creates session with Web3Principal
↓
✅ Authenticated → Redirect to dashboard
```

### MetaMask Flow

```
User clicks "Sign In with MetaMask"
↓
Connect to MetaMask (window.ethereum.request)
↓
Get wallet address
↓
Generate sign-in message
↓
Request signature (personal_sign)
↓
User signs message in MetaMask
↓
Submit to Oak-Auth-Web3 (/j_security_check POST)
↓
Oak verifies secp256k1 signature
↓
JAAS creates session with Web3Principal
↓
✅ Authenticated → Redirect to dashboard
```

---

## 🎨 Styling Details

### Color Palette
```css
Primary Gradient: #667eea → #764ba2
Success: #38ef7d
Error: #f5576c
Info: #667eea
Background: #000 → #1a1a2e → #16213e
```

### Animations
- **Gradient shift**: 15s infinite background animation
- **Pattern move**: 20s linear blockchain grid pattern
- **Slide in**: 0.6s ease-out from right
- **Button hover**: 0.3s ease transform + shadow

### Typography
```css
Font Family: 'Adobe Clean', 'Helvetica Neue', Arial
H1: 32px, weight 300
H2: 24px, weight 400
Body: 16px base
```

---

## 🔗 Integration Points

### Dependencies
1. **BiometricManager.js** - WebAuthn wrapper
   - Located: `/apps/blockchain-aem/components/biometric-auth/clientlibs/js/`
   - Provides: `BiometricManager.isAvailable()`, authentication methods

2. **Oak-Auth-Web3** - JAAS LoginModule
   - Module: `jackrabbit-oak/oak-auth-web3/`
   - Handles: P-256 verification, session creation

3. **MetaMask** - Browser extension
   - Provides: `window.ethereum` API
   - Used for: Wallet connection, secp256k1 signatures

### Endpoints
- `GET /j_security_check?biometric_challenge=true` - Get auth challenge
- `POST /j_security_check` - Submit authentication (biometric or MetaMask)
- Redirects to: `/content/blockchain-aem/` on success

---

## 🐛 Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Biometrics Not Available" | Device doesn't support platform authenticator | Use MetaMask instead |
| "Biometric not registered" | No credentialId in localStorage | Register at oak-chain publisher first |
| "MetaMask not installed" | Extension not present | Install MetaMask |
| "Authentication cancelled" | User cancelled biometric scan | Try again |
| "Authentication failed" | Invalid signature | Check Oak-Auth-Web3 logs |

### Debug Mode

Open browser console to see detailed logs:
```javascript
🔐 Blockchain AEM Login initializing...
✅ Biometric authentication available
✅ Biometric signature obtained
```

---

## 📱 Responsive Design

### Desktop (> 768px)
- Login box: Right-aligned, 480-600px width
- Full animations and effects
- Adobe logo in top-right

### Mobile (< 768px)
- Login box: Centered, 90% width
- Reduced padding (24px)
- Smaller typography
- Touch-optimized buttons (48px+ tap targets)

---

## ♿ Accessibility

### Features
- **Keyboard navigation**: Tab through all interactive elements
- **Focus indicators**: 3px outline on focus
- **Screen reader support**: Semantic HTML, ARIA labels
- **Color contrast**: WCAG AA compliant
- **Touch targets**: Minimum 44x44px

### Testing
```bash
# Lighthouse accessibility audit
lighthouse http://localhost:4502/content/blockchain-aem/login.html --only-categories=accessibility
```

---

## 🔮 Future Enhancements

1. **Remember device** - Skip biometric for trusted devices
2. **Multiple wallets** - Switch between registered wallets
3. **QR code login** - Mobile → desktop authentication
4. **Social recovery** - Guardian-based account recovery
5. **Session management** - View active sessions, logout all devices
6. **2FA options** - Optional second factor (TOTP, email)

---

## 📚 References

### Internal
- Oak-Auth-Web3 module: `jackrabbit-oak/oak-auth-web3/`
- Biometric manager: `apps/blockchain-aem/components/biometric-auth/`
- ADR 023: EIP-7951 Biometric Authentication

### External
- WebAuthn Spec: https://w3c.github.io/webauthn/
- FIDO2: https://fidoalliance.org/fido2/
- EIP-7951: https://eips.ethereum.org/EIPS/eip-7951
- Adobe Clean Font: https://fonts.adobe.com/fonts/adobe-clean

---

**Status**: ✅ Ready for testing  
**Created**: 2025-11-30  
**Inspired by**: Adobe Experience Manager login page

