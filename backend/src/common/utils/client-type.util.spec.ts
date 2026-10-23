import { ForbiddenException } from '@nestjs/common';
import { UserType } from '../enums';
import {
  assertGstClient,
  assertItrClient,
  hasGstService,
  hasItrService,
} from './client-type.util';

describe('client-type util', () => {
  it.each([
    [UserType.GENERAL, false, false],
    [UserType.NORMAL, false, false],
    [UserType.GST, true, false],
    [UserType.ITR, false, true],
    [UserType.BOTH, true, true],
  ])('%s → gst=%s itr=%s', (type, gst, itr) => {
    expect(hasGstService(type)).toBe(gst);
    expect(hasItrService(type)).toBe(itr);
  });

  it('refuses GST work for non-GST clients and ITR work for non-ITR clients', () => {
    expect(() => assertGstClient({ user_type: UserType.ITR })).toThrow(
      ForbiddenException,
    );
    expect(() => assertGstClient({ user_type: UserType.GENERAL })).toThrow(
      ForbiddenException,
    );
    expect(() => assertItrClient({ user_type: UserType.GST })).toThrow(
      ForbiddenException,
    );
    expect(() => assertItrClient({ user_type: UserType.GENERAL })).toThrow(
      ForbiddenException,
    );
    expect(() => assertGstClient({ user_type: UserType.BOTH })).not.toThrow();
    expect(() => assertItrClient({ user_type: UserType.BOTH })).not.toThrow();
  });
});
