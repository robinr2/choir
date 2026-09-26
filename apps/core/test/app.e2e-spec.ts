import request from 'supertest';
import { TestApp } from './test-app.js';

const testApp = TestApp.use();

it('/ (GET)', () => {
  return request(testApp.app.getHttpServer())
    .get('/')
    .expect(200)
    .expect('Hello World!');
});
