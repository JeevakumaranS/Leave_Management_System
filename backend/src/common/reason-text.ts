import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const REASON_TEXT_PATTERN = /^[\p{L}\p{N} .,!?'"():;\/-]+$/u;

export function IsReasonText(
  label: string,
  maxLength = 250,
): PropertyDecorator {
  return (target, propertyKey) => {
    Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))(
      target,
      propertyKey,
    );
    IsNotEmpty({ message: `${label} is required.` })(target, propertyKey);
    IsString({ message: `${label} must be text.` })(target, propertyKey);
    MinLength(3, { message: `${label} must be at least 3 characters.` })(
      target,
      propertyKey,
    );
    MaxLength(maxLength, {
      message: `${label} must be no more than ${maxLength} characters.`,
    })(
      target,
      propertyKey,
    );
    Matches(REASON_TEXT_PATTERN, {
      message: `${label} may contain only letters, numbers, spaces, and basic punctuation.`,
    })(target, propertyKey);
  };
}
