export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  location: string;
  rawText: string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "delhi-ncr-winter-morning",
    name: "Delhi-NCR Morning Ward Monitoring (Messy)",
    location: "National Capital Region, Delhi",
    description: "Inconsistent headers, missing readings (NA/-999), mixed units, and acute industrial & traffic hotspots.",
    rawText: `Location / Station, Timestamp, PM2.5 (ug/m3), PM 10, AQI Index, NO2 (ppm), Humidity, Notes
Anand Vihar Ward 4, 2026-11-14 07:00, 482, 610, 485, 0.082, 78%, Severe traffic & inter-state bus terminal
Punjabi Bagh Sensor A, 2026-11-14 07:00, 395, 480, 412, 0.054, 75%, Ring road congestion
Okhla Phase II (Industrial), 2026-11-14 07:00, 520, 680, 498, 0.110, 71%, Waste-to-energy perimeter
R.K. Puram Ward 12, 2026-11-14 07:00, 310, 390, 345, 0.041, 80%, Residential colony
Rohini Sector 16, 2026-11-14 07:00, NA, 440, ?, 0.048, 77%, PM2.5 sensor telemetry failure
Jahangirpuri Station 2, 2026-11-14 07:00, 465, 590, 470, 0.075, 79%, Solid waste dump proximity
Lodhi Road Background, 2026-11-14 07:00, 185, 230, 245, 0.025, 82%, Green institutional belt
Wazirpur Industrial, 2026-11-14 07:00, 540, 710, 500, 0.135, 70%, Metal processing clusters
Bawana Ward 1, 2026-11-14 07:00, -999, -999, null, 0.090, 68%, Complete particulate sensor blackout
Narela Industrial Zone, 2026-11-14 07:00, 495, 630, 488, 0.098, 73%, Industrial boiler stacks
Dwarka Sector 8 School Hub, 2026-11-14 07:00, 290, 340, 315, 0.038, 81%, School bus arrival window
Connaught Place Central, 2026-11-14 07:00, 240, 295, 280, 0.032, 79%, Commercial zone prior to market opening`
  },
  {
    id: "delhi-ncr-winter-evening",
    name: "Delhi-NCR Post-Intervention Evening Brief",
    location: "National Capital Region, Delhi",
    description: "Follow-up monitoring 10 hours later following anti-smog gun deployment and localized traffic diversions.",
    rawText: `Location / Station, Timestamp, PM2.5 (ug/m3), PM 10, AQI Index, NO2 (ppm), Humidity, Notes
Anand Vihar Ward 4, 2026-11-14 17:00, 360, 450, 395, 0.065, 62%, Water sprinklers deployed at ISBT
Punjabi Bagh Sensor A, 2026-11-14 17:00, 340, 410, 370, 0.048, 60%, Evening peak hour buildup
Okhla Phase II (Industrial), 2026-11-14 17:00, 480, 600, 465, 0.095, 58%, Industrial shift change
R.K. Puram Ward 12, 2026-11-14 17:00, 260, 320, 305, 0.035, 65%, Residential traffic active
Rohini Sector 16, 2026-11-14 17:00, 320, 390, 350, 0.042, 63%, Sensor rebooted; reading recovered
Jahangirpuri Station 2, 2026-11-14 17:00, 410, 510, 425, 0.068, 64%, Localized biomass burning curbed
Lodhi Road Background, 2026-11-14 17:00, 160, 200, 215, 0.022, 68%, Institutional area steady
Wazirpur Industrial, 2026-11-14 17:00, 490, 640, 470, 0.115, 59%, Partial boiler restriction enforced
Bawana Ward 1, 2026-11-14 17:00, 510, 660, 490, 0.102, 60%, Secondary telemetry node online
Narela Industrial Zone, 2026-11-14 17:00, 430, 540, 440, 0.085, 61%, Smog gun misting operational
Dwarka Sector 8 School Hub, 2026-11-14 17:00, 220, 270, 265, 0.030, 66%, Schools closed for the day
Connaught Place Central, 2026-11-14 17:00, 275, 330, 310, 0.040, 64%, Heavy evening retail traffic`
  },
  {
    id: "mumbai-harbor-industrial",
    name: "Mumbai Coastal & Industrial Belt (Messy CSV)",
    location: "Mumbai Metropolitan Region",
    description: "Marine boundary layer data with refinery emissions, construction dust, and uncalibrated micro-sensors.",
    rawText: `Site,Time,PM2.5,PM10,AQI,SO2,Humidity
Chembur Mahul Hub, 2026-11-14 08:30, 280 ug/m3, 390, 320, 45 ppb, 85%
Bandra-Kurla Complex (BKC), 2026-11-14 08:30, 195, 290, 245, 18 ppb, 79%
Worli Seaface Sensor 01, 2026-11-14 08:30, 68, 110, 115, 8 ppb, 88%
Deonar Dumping Environs, 2026-11-14 08:30, 345, 510, 390, 38 ppb, 81%
Andheri East Metro Line, 2026-11-14 08:30, 225, 340, 275, 22 ppb, 78%
Navi Mumbai Turbhe MIDC, 2026-11-14 08:30, 310, 430, 340, 52 ppb, 74%
Sion Circle Transit, 2026-11-14 08:30, 260, 375, 305, 25 ppb, 80%
Colaba Navy Nagar, 2026-11-14 08:30, 55, 85, 95, 6 ppb, 89%
Malad West Link Road, 2026-11-14 08:30, null, null, null, null, null
Kandivali West Industrial, 2026-11-14 08:30, 240, 350, 290, 28 ppb, 76%`
  }
];
