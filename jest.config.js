module.exports = {
  roots: [
    "<rootDir>/src/"
  ],
  "testMatch": [
    "<rootDir>/src/**/*.(test).{js,jsx,ts,tsx}",
    "<rootDir>/src/**/?(*.)(spec|test).{js,jsx,ts,tsx}"
  ],
  "transform": {
    "^.+\\.(ts|tsx)$": "ts-jest"
  }
}