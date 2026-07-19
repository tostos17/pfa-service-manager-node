export class AgeCalculator {
    static getAgeInYearsAndDays(birthDateStr: string): string {
        const birthDate = new Date(birthDateStr);
        const today = new Date();

        if (birthDate > today) {
            throw new Error('Birth date cannot be in the future.');
        }

        let years = today.getFullYear() - birthDate.getFullYear();

        const lastBirthday = new Date(birthDate);
        lastBirthday.setFullYear(birthDate.getFullYear() + years);
        if (lastBirthday > today) {
            years--;
            lastBirthday.setFullYear(birthDate.getFullYear() + years);
        }

        const diffTime = today.getTime() - lastBirthday.getTime();
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return `${years} years and ${days} days`;
    }
}
