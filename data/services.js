// data/services.js
// Service catalog for Nails By Sally

export const SERVICES = [
  {
    id: 'classic-manicure',
    name: 'Classic Manicure',
    description: 'Nail shaping, cuticle care, exfoliation, massage, and polish.',
    durationMin: 45,
    price: 45,
    category: 'Manicures'
  },
  {
    id: 'classic-pedicure',
    name: 'Pedicure',
    description: 'Relaxing foot soak, exfoliation, callus care, massage, and polish.',
    durationMin: 60,
    price: 55,
    category: 'Pedicures'
  },
  {
    id: 'gel-extensions',
    name: 'Gel Extensions',
    description: 'Lightweight, durable extensions with a glossy gel finish.',
    durationMin: 120,
    price: 70,
    category: 'Extensions'
  },
  {
    id: 'custom-nail-art',
    name: 'Custom Nail Art',
    description: 'Bespoke nail art designs tailored to your style.',
    durationMin: 60,
    price: 15,
    category: 'Nail Art'
  },
  {
    id: 'acrylic-extensions',
    name: 'Acrylic Extensions',
    description: 'Strong and stylish acrylic extensions in any shape you love.',
    durationMin: 120,
    price: 65,
    category: 'Extensions'
  },
  {
    id: 'dip-powder',
    name: 'Dip Powder',
    description: 'Long-lasting, chip-resistant dip powder with a smooth finish.',
    durationMin: 60,
    price: 50,
    category: 'Manicures'
  },
  {
    id: 'strength-treatment',
    name: 'Strength Treatment',
    description: 'Nourishing treatment to strengthen, restore, and protect natural nails.',
    durationMin: 30,
    price: 40,
    category: 'Treatments'
  }
];

// Helper function to get a service by ID
export function getService(id) {
  return SERVICES.find(service => service.id === id);
}

// Helper function to get services by category
export function getServicesByCategory(category) {
  return SERVICES.filter(service => service.category === category);
}

// Export service categories
export const CATEGORIES = [
  'Manicures',
  'Pedicures',
  'Extensions',
  'Nail Art',
  'Treatments'
];