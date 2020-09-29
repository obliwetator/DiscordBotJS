import { PerformanceObserver, performance } from 'perf_hooks';

export const obs = new PerformanceObserver((list) => {
	console.log(list.getEntries()[0].name + ": " + list.getEntries()[0].duration);
	performance.clearMarks();
});
obs.observe({ entryTypes: ['measure'] });