import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { RentAgreement } from '../entities';
import { StorageService } from '../storage/storage.service';
import { LibreOfficeService } from './libreoffice.service';
import { RentAgreementsService } from './rent-agreements.service';

const service = (secret: string) =>
  new RentAgreementsService(
    {} as Repository<RentAgreement>,
    {
      get: (k: string) =>
        ({
          'onlyOffice.jwtSecret': secret,
          'onlyOffice.serverUrl': 'https://office.snbajaj.com',
        })[k],
    } as unknown as ConfigService,
    {} as StorageService,
    {} as LibreOfficeService,
  );

const payload = {
  status: 2,
  url: 'https://office.snbajaj.com/cache/file.docx',
};

describe('OnlyOffice save callback', () => {
  describe('with a JWT secret', () => {
    const s = service('office-secret');

    it('accepts a payload signed by the document server (body.token)', () => {
      const token = jwt.sign(payload, 'office-secret');
      expect(s.trustedOfficeCallback({ ...payload, token })).toMatchObject(
        payload,
      );
    });

    it('accepts the header form, where the payload is nested', () => {
      const token = jwt.sign({ payload }, 'office-secret');
      expect(s.trustedOfficeCallback({}, `Bearer ${token}`)).toMatchObject(
        payload,
      );
    });

    it('rejects unsigned or forged callbacks', () => {
      expect(s.trustedOfficeCallback(payload)).toBeNull();
      const forged = jwt.sign(
        { status: 2, url: 'http://169.254.169.254/latest/meta-data' },
        'guess',
      );
      expect(s.trustedOfficeCallback({ token: forged })).toBeNull();
    });
  });

  describe('without a JWT secret', () => {
    const s = service('');

    it('only downloads from the configured OnlyOffice server', () => {
      expect(s.trustedOfficeCallback(payload)).toEqual(payload);
      expect(
        s.trustedOfficeCallback({ status: 2, url: 'http://169.254.169.254/x' }),
      ).toBeNull();
    });
  });
});
