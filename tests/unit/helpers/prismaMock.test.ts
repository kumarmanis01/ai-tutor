import { prismaMock, resetPrismaMock } from '../../../tests/helpers/prismaMock';

describe('prismaMock helper', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('mock functions record calls and resetPrismaMock clears them', () => {
    // call a couple of mock functions
    prismaMock.answerEvent.count();
    prismaMock.misconception.findMany();
    prismaMock.$queryRaw();

    expect((prismaMock.answerEvent.count as jest.Mock).mock.calls.length).toBe(1);
    expect((prismaMock.misconception.findMany as jest.Mock).mock.calls.length).toBe(1);
    expect((prismaMock.$queryRaw as jest.Mock).mock.calls.length).toBe(1);

    // reset all mocks
    resetPrismaMock();

    expect((prismaMock.answerEvent.count as jest.Mock).mock.calls.length).toBe(0);
    expect((prismaMock.misconception.findMany as jest.Mock).mock.calls.length).toBe(0);
    expect((prismaMock.$queryRaw as jest.Mock).mock.calls.length).toBe(0);
  });
});
