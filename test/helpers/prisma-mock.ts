export function createPrismaMock() {
  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    processedEmail: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    processedFacebookPost: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    listing: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    listingScore: {
      create: jest.fn(),
      count: jest.fn(),
    },
    geocodeCache: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    pipelineRun: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}
