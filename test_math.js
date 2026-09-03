const currClose = 77615.24;
const currHigh = 77975.46;
const currLow = 77608;

const B1 = 78132.7824400342;
const B2 = 77809.4482288178;
const B3 = 77459.1695;
const B4 = 77108.8907711822;
const B5 = 76785.5565599658;

const isLongRule1 = (currClose <= B4 && currClose >= B5);
const isLongRule2 = (currLow <= B4 && currClose > B4 && currClose <= B3);
const isLongCandidate = isLongRule1 || isLongRule2;

const isShortRule1 = (currClose >= B2 && currClose <= B1);
const isShortRule2 = (currHigh >= B2 && currClose < B2 && currClose >= B3);
const isShortCandidate = isShortRule1 || isShortRule2;

let signal = 'NONE';
let armBounds = undefined;

if (isLongCandidate) {
    signal = 'LONG';
    armBounds = { upper: B3, lower: B5 };
} else if (isShortCandidate) {
    signal = 'SHORT';
    armBounds = { upper: B1, lower: B3 };
}

console.log({
    isShortRule1,
    isShortRule2,
    signal,
    armBounds
});
