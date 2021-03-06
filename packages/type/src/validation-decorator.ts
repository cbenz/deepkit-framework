/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {createFreeDecoratorContext} from './decorator-builder';
import {PropertyValidator, ValidatorFn} from './decorators';
import {ClassType, isArray} from '@deepkit/core';
import {PropertyValidatorError} from './validation';
import validator from 'validator';

export class ValidationContextType {
    validators: (ClassType<PropertyValidator> | ValidatorFn)[] = [];
}

export class FreeValidationContext {
    t = new ValidationContextType();

    isAlpha(locale: validator.AlphaLocale = 'en-US') {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isAlpha(value, locale)) return;
            return new PropertyValidatorError('isAlpha', 'Not alpha');
        });
    }

    isAlphanumeric(locale: validator.AlphanumericLocale = 'en-US') {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isAlphanumeric(value, locale)) return;
            return new PropertyValidatorError('isAlphanumeric', 'Not alphanumeric');
        });
    }

    isAscii() {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isAscii(value)) return;
            return new PropertyValidatorError('isAscii', 'Not ASCII');
        });
    }

    isBIC() {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isBIC(value)) return;
            return new PropertyValidatorError('isBIC', 'Not BIC');
        });
    }

    isBase32() {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isBase32(value)) return;
            return new PropertyValidatorError('isBase32', 'Not Base32');
        });
    }

    isBase64() {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isBase64(value)) return;
            return new PropertyValidatorError('isBase58', 'Not Base64');
        });
    }

    isBtcAddress() {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isBtcAddress(value)) return;
            return new PropertyValidatorError('isBtcAddress', 'Not a BTC address');
        });
    }

    isCreditCard() {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isCreditCard(value)) return;
            return new PropertyValidatorError('isCreditCard', 'Not a credit card');
        });
    }

    isDataURI() {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isDataURI(value)) return;
            return new PropertyValidatorError('isDataURI', 'Not a data URI');
        });
    }

    isDecimal(options?: validator.IsDecimalOptions) {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value) return;
            if (validator.isDecimal(value, options)) return;
            return new PropertyValidatorError('isDecimal', 'Not a decimal');
        });
    }

    isDivisibleBy(num: any) {
        this.t.validators.push((value: any) => {
            if ('number' !== typeof value) return;
            if (value % num === 0) return;
            return new PropertyValidatorError('isDivisibleBy', 'Not divisible by ' + num);
        });
    }

    minLength(length: number) {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.length >= length) return;

            return new PropertyValidatorError('minLength', 'Min length is ' + length);
        });
    }

    maxLength(length: number) {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.length <= length) return;

            return new PropertyValidatorError('maxLength', 'Max length is ' + length);
        });
    }

    includes(include: any) {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (value.includes(include)) return;

            return new PropertyValidatorError('includes', `Needs to include '${include}'`);
        });
    }

    excludes(excludes: any) {
        this.t.validators.push((value: any) => {
            if ('string' !== typeof value && !isArray(value)) return;
            if (!value.includes(excludes)) return;

            return new PropertyValidatorError('excludes', `Needs to exclude '${excludes}'`);
        });
    }

    min(min: number, excluding: boolean = false) {
        this.t.validators.push((value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (excluding && value <= min) return new PropertyValidatorError('min', 'Number needs to be greater than ' + min);
            if (!excluding && value < min) return new PropertyValidatorError('min', 'Number needs to be greater than or equal to ' + min);
            return;
        });
    }

    max(max: number, excluding: boolean = false) {
        this.t.validators.push((value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (excluding && value >= max) return new PropertyValidatorError('max', 'Number needs to be smaller than ' + max);
            if (!excluding && value > max) return new PropertyValidatorError('max', 'Number needs to be smaller than or equal to ' + max);
            return;
        });
    }

    positive(includingZero: boolean = true) {
        this.t.validators.push((value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value > 0) return;
            if (includingZero && value === 0) return;

            return new PropertyValidatorError('positive', 'Number needs to be positive');
        });
    }

    negative(includingZero: boolean = true) {
        this.t.validators.push((value: any) => {
            if ('number' !== typeof value && 'bigint' !== typeof value) return;
            if (value < 0) return;
            if (includingZero && value === 0) return;

            return new PropertyValidatorError('negative', 'Number needs to be negative');
        });
    }
}

export const validation = createFreeDecoratorContext(FreeValidationContext);

export const v = validation;
