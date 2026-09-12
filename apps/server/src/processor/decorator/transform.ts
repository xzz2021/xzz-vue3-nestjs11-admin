import { Transform } from "class-transformer";

/**
 * @description trim spaces from start and end, replace multiple spaces with one.
 *
 * @example
 * @ApiProperty()
 * @IsString()
 * @Trim()
 * name: string;
 *
 * @returns PropertyDecorator
 * @constructor
 */
export function Trim(): PropertyDecorator {
  return Transform((params: { value: string | string[] }) => {
    const value = params.value;

    if (Array.isArray(value)) {
      return value.map((v) => v.trim().replaceAll(/\s\s+/g, " "));
    }

    return value.trim().replaceAll(/\s\s+/g, " ");
  });
}

export function ToNumber(): PropertyDecorator {
  return Transform((params: { value: string[] | string }) => {
    if (Array.isArray(params.value)) {
      return params.value.map((v) => Number(v));
    }

    return Number(params.value);
  });
}

export function ToInt(): PropertyDecorator {
  return Transform((params: { value: string }) => {
    const newNumber = Number(params.value);

    if (Number.isNaN(newNumber)) {
      return params.value;
    }

    if (newNumber % 1 === 0) {
      return newNumber;
    }

    return Math.floor(newNumber);
  });
}

export function ToBoolean(): PropertyDecorator {
  return Transform(
    (params: { value: any }) => {
      switch (params.value) {
        case "true": {
          return true;
        }

        case "false": {
          return false;
        }

        default: {
          return params.value;
        }
      }
    },
    { toClassOnly: true },
  );
}

export function ToLowerCase(): PropertyDecorator {
  return Transform(
    (params: { value: any }) => {
      const value = params.value;

      if (!value) {
        return;
      }

      if (!Array.isArray(value)) {
        return value.toLowerCase();
      }

      return value.map((v) => v.toLowerCase());
    },
    {
      toClassOnly: true,
    },
  );
}

export function ToUpperCase(): PropertyDecorator {
  return Transform(
    (params: { value: any }) => {
      const value = params.value;

      if (!value) {
        return;
      }

      if (!Array.isArray(value)) {
        return value.toUpperCase();
      }

      return value.map((v) => v.toUpperCase());
    },
    {
      toClassOnly: true,
    },
  );
}
