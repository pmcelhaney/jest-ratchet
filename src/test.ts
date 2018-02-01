jest.mock('fs');

import _fs from 'fs';
import { resolve } from 'path';
import JestRatchet from './index';

const fs = _fs as typeof _fs & {
  __addMockFile: (name: RegExp, value: string) => void;
  __resetMockFiles: () => void;
};

const mockConfig = {
  collectCoverage: true,
  coverageReporters: ['json-summary'],
};

describe('jest-ratchet', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fs.__resetMockFiles();
    process.cwd = jest.fn().mockReturnValue(resolve('./example'));
  });

  it('will initialize without error', () => {
    const config = {
      ...mockConfig,
      collectCoverage: true,
      coverageReporters: ['json-summary'],
    };
    const jestRatchet = new JestRatchet(config);

    expect(jestRatchet.getLastError).not.toThrowError();
  });

  it('will throw error when collectCoverage is not enabled', () => {
    const config = {
      ...mockConfig,
      collectCoverage: false,
      coverageReporters: undefined,
    };
    const jestRatchet = new JestRatchet(config);

    expect(jestRatchet.getLastError).toThrowError(/collectCoverage/);
  });

  it('will handle errors from onRunComplete', () => {
    console.error = jest.fn();

    const jestRatchet = new JestRatchet(mockConfig);
    jestRatchet.onRunComplete();
  });

  it('will ratchet percentages', () => {
    const threshold = {
      coverageThreshold: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50,
        },
      },
    };
    fs.__addMockFile(
      /\/coverage-summary\.json$/,
      JSON.stringify({
        total: {
          branches: {pct: 100},
          functions: {pct: 100},
          lines: {pct: 100},
          statements: {pct: 100},
        },
      }),
    );
    fs.__addMockFile(
      /\/package\.json$/,
      JSON.stringify({ ...threshold }),
    );

    const jestRatchet = new JestRatchet({
      ...mockConfig,
      ...threshold,
      rootDir: './example',
    });
    jestRatchet.onRunComplete();

    const writeFileSync = fs.writeFileSync as jest.Mock;
    expect(writeFileSync.mock.calls[0][1])
      .toEqual(
        JSON.stringify({
          coverageThreshold: {
            global: {
              branches: 100,
              functions: 100,
              lines: 100,
              statements: 100,
            },
          },
        }));
  });

  it('will respect the --config flag', () => {
    process.argv = ['', '', '--config', 'jestconfig.json'];
    const threshold = {
      coverageThreshold: {
        global: {
          branches: -50,
          functions: -50,
          lines: -50,
          statements: -50,
        },
      },
    };
    fs.__addMockFile(
      /\/coverage-summary\.json$/,
      JSON.stringify({
        total: {
          branches: {covered: 100},
          functions: {covered: 100},
          lines: {covered: 100},
          statements: {covered: 100},
        },
      }),
    );
    fs.__addMockFile(
      /\/jestconfig\.json$/,
      JSON.stringify({ ...threshold }),
    );

    const jestRatchet = new JestRatchet({ ...mockConfig, ...threshold });
    jestRatchet.onRunComplete();

    const writeFileSync = fs.writeFileSync as jest.Mock;
    expect(writeFileSync.mock.calls[0][1])
      .toEqual(
        JSON.stringify({
          coverageThreshold: {
            global: {
              branches: -100,
              functions: -100,
              lines: -100,
              statements: -100,
            },
          },
        }));
  });

  it('will handle edge cases', () => {
    const threshold = {
      coverageThreshold: {
        global: { bogus: {}},
      },
    } as any;
    fs.__addMockFile(
      /\/coverage-summary\.json$/,
      JSON.stringify({
        total: { bogus: {} },
      }),
    );
    fs.__addMockFile(
      /\/jestconfig\.json$/,
      JSON.stringify({ ...threshold }),
    );
    fs.existsSync = () => true;

    const jestRatchet = new JestRatchet({ ...mockConfig, ...threshold });
    jestRatchet.onRunComplete();
  });
});