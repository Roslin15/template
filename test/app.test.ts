import { App } from '../src/app';
import express from 'express';

describe('Test app', () => {
  test('Starting the app', () => {
    const useSpy = jest.spyOn(express.application, 'use');
    const testApp = new App().getExpressApp();
    expect(useSpy).toBeCalledTimes(8);
    expect(typeof testApp).toEqual('function');
  });
});
