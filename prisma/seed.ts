import { PrismaClient, Role, BookingStatus, PayoutStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'password123';

const CAR_IMAGES: Record<string, string> = {
  'Maruti Swift': 'https://imgd.aeplcdn.com/664x374/n/cw/ec/159099/swift-exterior-right-front-three-quarter-6.jpeg',
  'Hyundai Creta': 'https://imgd.aeplcdn.com/664x374/n/cw/ec/106815/creta-exterior-right-front-three-quarter-4.jpeg',
  'Tata Nexon EV': 'https://imgd.aeplcdn.com/664x374/n/cw/ec/156811/nexon-ev-exterior-right-front-three-quarter-2.jpeg',
  'Honda City': 'https://imgd.aeplcdn.com/664x374/n/cw/ec/134287/city-exterior-right-front-three-quarter-11.jpeg',
  'Mercedes GLA 200': 'https://imgd.aeplcdn.com/664x374/n/cw/ec/130591/gla-exterior-right-front-three-quarter-2.jpeg',
  'Toyota Innova Crysta': 'https://imgd.aeplcdn.com/664x374/n/cw/ec/40087/innova-crysta-exterior-right-front-three-quarter-5.jpeg',
  'Mahindra Thar': 'https://imgd.aeplcdn.com/664x374/n/cw/ec/141301/thar-exterior-right-front-three-quarter-2.jpeg',
  'Kia Seltos': 'https://imgd.aeplcdn.com/664x374/n/cw/ec/141301/seltos-exterior-right-front-three-quarter.jpeg',
};

async function main() {
  console.log('Seeding database...');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  await prisma.review.deleteMany();
  await prisma.payoutLedger.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.car.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      id: randomUUID(), fullName: 'Ziyam Admin', email: 'admin@ziyam.in', phoneNumber: '+919000000001',
      passwordHash, role: Role.ADMIN, isKycVerified: true,
    },
  });

  const hostRavi = await prisma.user.create({
    data: {
      id: randomUUID(), fullName: 'Ravi Kumar', email: 'ravi.host@ziyam.in', phoneNumber: '+919000000002',
      passwordHash, role: Role.SELF_HOST, isKycVerified: true, payoutAccountId: 'acct_mock_ravi',
      bio: 'Weekend car enthusiast renting out my well-maintained Swift and Creta in Bengaluru.',
    },
  });

  const hostFleet = await prisma.user.create({
    data: {
      id: randomUUID(), fullName: 'Metro Fleet Rentals', email: 'fleet@ziyam.in', phoneNumber: '+919000000003',
      passwordHash, role: Role.FLEET_OPERATOR, isKycVerified: true, payoutAccountId: 'acct_mock_metrofleet',
      bio: 'Multi-city fleet operator with 40+ verified vehicles across Mumbai, Delhi NCR, and Hyderabad.',
    },
  });

  const customer = await prisma.user.create({
    data: {
      id: randomUUID(), fullName: 'Aisha Sharma', email: 'aisha@example.com', phoneNumber: '+919000000004',
      passwordHash, role: Role.CUSTOMER, isKycVerified: true,
    },
  });

  // A disposable suspended account, purely so the admin panel's suspend/reactivate UI has an example to show.
  await prisma.user.create({
    data: {
      id: randomUUID(), fullName: 'Suspended Test User', email: 'suspended@example.com', phoneNumber: '+919000000005',
      passwordHash, role: Role.CUSTOMER, isKycVerified: false, isSuspended: true,
    },
  });

  console.log('Seed login → email: aisha@example.com / ravi.host@ziyam.in / fleet@ziyam.in / admin@ziyam.in, password: password123');

  const carDefs = [
    { owner: hostRavi, make: 'Maruti', model: 'Swift', registrationNo: 'KA01AB1234', year: 2022, category: 'Hatchback', fuelType: 'Petrol', transmission: 'Manual', seats: 5, dailyRate: 1199, city: 'Bengaluru', kmIncludedPerDay: 300, extraKmCharge: 8 },
    { owner: hostRavi, make: 'Hyundai', model: 'Creta', registrationNo: 'KA01CD5678', year: 2023, category: 'SUV', fuelType: 'Petrol', transmission: 'Automatic', seats: 5, dailyRate: 2499, city: 'Bengaluru', kmIncludedPerDay: 300, extraKmCharge: 12, featured: true },
    { owner: hostFleet, make: 'Tata', model: 'Nexon EV', registrationNo: 'DL02EF9012', year: 2023, category: 'EV', fuelType: 'Electric', transmission: 'Automatic', seats: 5, dailyRate: 2799, city: 'Delhi NCR', kmIncludedPerDay: 250, extraKmCharge: 14 },
    { owner: hostFleet, make: 'Honda', model: 'City', registrationNo: 'TS03GH3456', year: 2021, category: 'Sedan', fuelType: 'Petrol', transmission: 'Automatic', seats: 5, dailyRate: 1899, city: 'Hyderabad', kmIncludedPerDay: 300, extraKmCharge: 10, isAvailable: false },
    { owner: hostFleet, make: 'Mercedes', model: 'GLA 200', registrationNo: 'MH04IJ7890', year: 2023, category: 'Luxury', fuelType: 'Petrol', transmission: 'Automatic', seats: 5, dailyRate: 8999, city: 'Mumbai', kmIncludedPerDay: 200, extraKmCharge: 30, instantBook: false, featured: true },
    { owner: hostRavi, make: 'Toyota', model: 'Innova Crysta', registrationNo: 'KA01KL2345', year: 2022, category: 'MUV', fuelType: 'Diesel', transmission: 'Manual', seats: 7, dailyRate: 3499, city: 'Chennai', kmIncludedPerDay: 350, extraKmCharge: 15 },
    { owner: hostFleet, make: 'Mahindra', model: 'Thar', registrationNo: 'MH04MN6789', year: 2023, category: 'SUV', fuelType: 'Diesel', transmission: 'Manual', seats: 4, dailyRate: 2999, city: 'Mumbai', kmIncludedPerDay: 250, extraKmCharge: 16 },
    { owner: hostRavi, make: 'Kia', model: 'Seltos', registrationNo: 'KA01OP1122', year: 2022, category: 'SUV', fuelType: 'Petrol', transmission: 'Automatic', seats: 5, dailyRate: 2299, city: 'Bengaluru', kmIncludedPerDay: 300, extraKmCharge: 11 },
  ];

  const cars = [];
  for (const def of carDefs) {
    const { owner, ...rest } = def;
    const car = await prisma.car.create({
      data: {
        id: randomUUID(),
        ownerId: owner.id,
        ...rest,
        securityDeposit: rest.category === 'Luxury' ? 10000 : 3000,
        description: `A well-maintained ${rest.year} ${rest.make} ${rest.model} in excellent condition. AC, Bluetooth, and power steering. Ready for city drives or highway trips.`,
        images: [CAR_IMAGES[`${rest.make} ${rest.model}`] ?? CAR_IMAGES['Maruti Swift']],
        features: ['Air Conditioning', 'Bluetooth / Aux', 'Power Steering', 'Central Locking', 'Reverse Camera', 'USB Charging'],
      },
    });
    cars.push(car);
  }

  // A completed trip with a review, so the UI has real rating data to show
  const completedBooking = await prisma.booking.create({
    data: {
      id: randomUUID(),
      carId: cars[0].id,
      customerId: customer.id,
      startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      totalAmount: 2398,
      platformFee: 719.4,
      hostPayoutAmount: 1678.6,
      status: BookingStatus.COMPLETED,
      paymentIntentId: 'pi_seed_1',
    },
  });

  await prisma.payoutLedger.create({
    data: {
      bookingId: completedBooking.id,
      hostId: hostRavi.id,
      grossAmount: 2398,
      ziyamCut: 719.4,
      netPayout: 1678.6,
      status: PayoutStatus.SETTLED,
      scheduledFor: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      payoutTxnId: 'TXN_ZIYAM_SEED_1',
    },
  });

  await prisma.review.create({
    data: {
      id: randomUUID(),
      bookingId: completedBooking.id,
      carId: cars[0].id,
      authorId: customer.id,
      targetHostId: hostRavi.id,
      rating: 5,
      comment: 'Spotless car, Ravi was super responsive and pickup was right on time. Would rent again!',
    },
  });

  // A second completed trip whose payout failed (host had no payout account at settlement time),
  // so the admin panel's "Retry" action has something real to demonstrate.
  const failedPayoutBooking = await prisma.booking.create({
    data: {
      id: randomUUID(),
      carId: cars[5].id,
      customerId: customer.id,
      startTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      totalAmount: 6998,
      platformFee: 2099.4,
      hostPayoutAmount: 4898.6,
      status: BookingStatus.COMPLETED,
      paymentIntentId: 'pi_seed_3',
    },
  });
  await prisma.payoutLedger.create({
    data: {
      bookingId: failedPayoutBooking.id,
      hostId: hostRavi.id,
      grossAmount: 6998,
      ziyamCut: 2099.4,
      netPayout: 4898.6,
      status: PayoutStatus.FAILED,
      scheduledFor: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // An upcoming confirmed trip
  await prisma.booking.create({
    data: {
      id: randomUUID(),
      carId: cars[1].id,
      customerId: customer.id,
      startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      totalAmount: 4998,
      platformFee: 1499.4,
      hostPayoutAmount: 3498.6,
      status: BookingStatus.CONFIRMED,
      paymentIntentId: 'pi_seed_2',
    },
  });

  console.log(`Seeded ${cars.length} cars, 5 users, 3 bookings, 1 review, 1 failed payout (for retry demo).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
