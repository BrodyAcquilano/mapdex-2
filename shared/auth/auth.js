export function hasExactKeys(payload, allowedKeys) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const keys = Object.keys(payload);

  return (
    keys.length === allowedKeys.length &&
    allowedKeys.every((key) => Object.prototype.hasOwnProperty.call(payload, key))
  );
}

export function hasNoKeys(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return true;
  }

  return Object.keys(payload).length === 0;
}

export function validateAuthToken(token) {
  if (typeof token !== "string") return "Invalid token.";

  const normalizedToken = token.trim();

  if (!normalizedToken) return "Invalid token.";

  // Tokens are generated with crypto.randomBytes(32).toString("hex")
  if (!/^[a-f0-9]{64}$/i.test(normalizedToken)) {
    return "Invalid token.";
  }

  return null;
}

export function validateEmail(email) {
  if (typeof email !== "string") return "Email must be text.";

  const normalizedEmail = email.trim();

  if (!normalizedEmail) return "Email is required.";
  if (/\s/.test(normalizedEmail)) return "Email cannot contain spaces.";

  const atMatches = normalizedEmail.match(/@/g) || [];
  if (atMatches.length !== 1) return "Email must contain exactly one @ symbol.";

  const [localPart, domainPart] = normalizedEmail.split("@");

  if (!localPart || localPart.length < 1) {
    return "Email must have at least 1 character before @.";
  }

  if (!domainPart) {
    return "Email must have a domain after @.";
  }

  if (domainPart.startsWith(".") || domainPart.endsWith(".")) {
    return "Email domain cannot start or end with a period.";
  }

  if (!domainPart.includes(".")) {
    return "Email domain must include a period.";
  }

  const domainSections = domainPart.split(".");
  const tld = domainSections[domainSections.length - 1];

  if (domainSections.some((part) => !part)) {
    return "Email domain format is invalid.";
  }

  if (domainSections[0].length < 1) {
    return "Email must have at least 1 character between @ and .";
  }

  if (!tld || tld.length < 2) {
    return "Email ending must be at least 2 characters.";
  }

  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizedEmail)) {
    return "Email format is invalid.";
  }

  return null;
}

export function validateUserName(userName) {
  if (typeof userName !== "string") return "Username must be text.";

  const normalizedUserName = userName.trim();

  if (!normalizedUserName) return "Username is required.";

  if (normalizedUserName.length < 3) {
    return "Username must be at least 3 characters.";
  }

  if (normalizedUserName.length > 24) {
    return "Username must be 24 characters or less.";
  }

  if (/\s/.test(normalizedUserName)) {
    return "Username cannot contain spaces.";
  }

  if (!/^[A-Za-z0-9._-]+$/.test(normalizedUserName)) {
    return "Username may only contain letters, numbers, periods, underscores, and hyphens.";
  }

  if (/^[._-]|[._-]$/.test(normalizedUserName)) {
    return "Username cannot start or end with a period, underscore, or hyphen.";
  }

  if (/(\.\.|__|--)/.test(normalizedUserName)) {
    return "Username cannot contain repeated separators.";
  }

  return null;
}

export function validatePassword(password, email = "") {
  if (typeof password !== "string") return "Password must be text.";

  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(password)) return "Password must include at least one letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";

  if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]\/~`+=;']/.test(password)) {
    return "Password must include at least one special character.";
  }

  if (email) {
    if (typeof email !== "string") return null;

    const lowerPassword = password.toLowerCase();
    const lowerEmail = email.toLowerCase();
    const emailLocalPart = lowerEmail.split("@")[0];

    if (lowerPassword === lowerEmail) {
      return "Password cannot be the same as your email.";
    }

    if (lowerPassword.includes(lowerEmail)) {
      return "Password cannot contain your email address.";
    }

    if (emailLocalPart && lowerPassword.includes(emailLocalPart)) {
      return "Password cannot contain your email name.";
    }
  }

  return null;
}