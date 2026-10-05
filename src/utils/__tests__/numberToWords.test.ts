import { numberToWords } from '../numberToWords';

describe('numberToWords Unit Tests', () => {
    test('converts 0 correctly', () => {
        expect(numberToWords(0)).toBe('Zero Naira Only');
    });

    test('converts single digits correctly', () => {
        expect(numberToWords(5)).toBe('Five Naira Only');
        expect(numberToWords(9)).toBe('Nine Naira Only');
    });

    test('converts tens and teens correctly', () => {
        expect(numberToWords(12)).toBe('Twelve Naira Only');
        expect(numberToWords(19)).toBe('Nineteen Naira Only');
        expect(numberToWords(20)).toBe('Twenty Naira Only');
        expect(numberToWords(45)).toBe('Forty-Five Naira Only');
    });

    test('converts hundreds correctly', () => {
        expect(numberToWords(100)).toBe('One Hundred Naira Only');
        expect(numberToWords(350)).toBe('Three Hundred and Fifty Naira Only');
        expect(numberToWords(999)).toBe('Nine Hundred and Ninety-Nine Naira Only');
    });

    test('converts thousands correctly', () => {
        expect(numberToWords(1000)).toBe('One Thousand Naira Only');
        expect(numberToWords(1500)).toBe('One Thousand Five Hundred Naira Only');
        expect(numberToWords(25320)).toBe('Twenty-Five Thousand Three Hundred and Twenty Naira Only');
    });

    test('converts millions correctly', () => {
        expect(numberToWords(1000000)).toBe('One Million Naira Only');
        expect(numberToWords(1200350)).toBe('One Million Two Hundred Thousand Three Hundred and Fifty Naira Only');
    });

    test('converts decimals (Kobo) correctly', () => {
        expect(numberToWords(150.50)).toBe('One Hundred and Fifty Naira and Fifty Kobo Only');
        expect(numberToWords(25000.05)).toBe('Twenty-Five Thousand Naira and Five Kobo Only');
    });

    test('converts pure decimals (only Kobo) correctly', () => {
        expect(numberToWords(0.75)).toBe('Seventy-Five Kobo Only');
        expect(numberToWords(0.05)).toBe('Five Kobo Only');
    });
});
