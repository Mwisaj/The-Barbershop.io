export const DEFAULT_GALLERY = ["Fade", "Beard line-up", "Kids cut", "Before & after", "Classic taper", "Straight-razor finish"].map((caption, index) => ({ id: `gallery-${index}`, caption, src: index === 0 ? 'default-chair' : '' }));

export const DEFAULT_SERVICES = [
  { id: "s1", name: "Standard Haircut", duration: 30, price: 100 },
  { id: "s2", name: "Haircut and Beard", duration: 45, price: 150 },
  { id: "s3", name: "Beard Shaping", duration: 20, price: 30 },
  { id: "s4", name: "Kids' Haircut", duration: 30, price: 50 },
];

export const DEFAULT_SCHEDULE = {
  enabledDays: [0],            // 0 = Sunday ... 6 = Saturday
  openTime: "08:00",
  closeTime: "17:00",
  slotMinutes: 30,
}; 

export const DEFAULT_SETTINGS = {
  name: "TJ Barbershop",
  slogan: "Your Style, Our Craft.",
  address: "Mobile Barbershop",
  phone: "0972551954",
  whatsapp: "260972 551 954",
  mapsUrl: "https://maps.google.com/?q=Cairo+Road+Lusaka",
  instagram: "https://instagram.com",
  facebook: "https://facebook.com",
  tiktok: "https://tiktok.com",
  policy: "Please arrive 5 minutes early. Cancel or reschedule at least 2 hours before your slot using your booking reference. Arriving more than 15 minutes late may mean your slot is given to the next customer.",
};
