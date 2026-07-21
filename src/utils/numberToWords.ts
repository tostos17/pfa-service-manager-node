export function numberToWords(num: number): string {
    if (num === 0) return 'Zero Naira Only';

    const ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Million', 'Billion'];

    function helper(n: number): string {
        if (n < 20) return ones[n];
        if (n < 100) {
            const digit = n % 10;
            return tens[Math.floor(n / 10)] + (digit ? '-' + ones[digit] : '');
        }
        if (n < 1000) {
            const remainder = n % 100;
            return ones[Math.floor(n / 100)] + ' Hundred' + (remainder ? ' and ' + helper(remainder) : '');
        }
        return '';
    }

    const val = parseFloat(num.toFixed(2));
    let integerPart = Math.floor(val);
    let decimalPart = Math.round((val - integerPart) * 100);

    let result = '';
    let scaleIndex = 0;

    let tempInt = integerPart;
    while (tempInt > 0) {
        const chunk = tempInt % 1000;
        if (chunk > 0) {
            const chunkStr = helper(chunk);
            result = chunkStr + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '') + (result ? ' ' + result : '');
        }
        tempInt = Math.floor(tempInt / 1000);
        scaleIndex++;
    }

    let words = '';
    if (integerPart > 0) {
        words += result.trim() + ' Naira';
    }

    if (decimalPart > 0) {
        const decStr = helper(decimalPart);
        if (integerPart > 0) {
            words += ' and ' + decStr.trim() + ' Kobo';
        } else {
            words += decStr.trim() + ' Kobo';
        }
    }

    if (words) {
        words += ' Only';
    } else {
        words = 'Zero Naira Only';
    }

    return words;
}
