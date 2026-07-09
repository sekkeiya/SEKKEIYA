// Solar position calculations for architectural sun diagrams

export interface SunPosition {
  altitude: number; // degrees above horizon (negative = below)
  azimuth: number;  // degrees from North, clockwise
}

// Day-of-year for middle of each month
const DOY_MID = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

export function calcSunPosition(lat: number, month: number, timeHour: number): SunPosition {
  const doy = DOY_MID[Math.max(0, Math.min(11, month - 1))];
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (doy - 81));
  const declRad = declination * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const hourAngle = (timeHour - 12) * 15;
  const hourRad = hourAngle * Math.PI / 180;

  const sinAlt = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;

  const cosAltRad = Math.cos(altitude * Math.PI / 180);
  const cosAz = cosAltRad > 0.001
    ? (Math.sin(declRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * cosAltRad)
    : 0;
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
  if (hourAngle > 0) azimuth = 360 - azimuth;

  return { altitude, azimuth };
}

// Sunrise and sunset hours for given lat/month
export function calcSunriseSunset(lat: number, month: number): { rise: number; set: number } {
  const doy = DOY_MID[Math.max(0, Math.min(11, month - 1))];
  const decl = 23.45 * Math.sin((2 * Math.PI / 365) * (doy - 81));
  const declRad = decl * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const cosH0 = -Math.tan(latRad) * Math.tan(declRad);
  if (cosH0 < -1) return { rise: 0, set: 24 };
  if (cosH0 > 1) return { rise: 12, set: 12 };
  const H0 = (Math.acos(cosH0) * 180 / Math.PI) / 15;
  return { rise: 12 - H0, set: 12 + H0 };
}
