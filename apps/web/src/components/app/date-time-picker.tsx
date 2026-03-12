import { CalendarRange, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DateTimePickerProps = {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
};

const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;

function padNumber(value: number) {
	return String(value).padStart(2, "0");
}

function parseLocalDateTime(value: string) {
	if (!value) {
		return null;
	}
	const [datePart, timePart] = value.split("T");
	if (!datePart || !timePart) {
		return null;
	}
	const [year, month, day] = datePart.split("-").map(Number);
	const [hours, minutes] = timePart.split(":").map(Number);
	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day) ||
		!Number.isFinite(hours) ||
		!Number.isFinite(minutes)
	) {
		return null;
	}
	const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
	return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateTimeValue(date: Date) {
	return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
		date.getDate(),
	)}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function formatTriggerLabel(date: Date) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

function formatPreviewLabel(date: Date) {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "short",
		month: "long",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

function toMeridiem(hours24: number) {
	if (hours24 === 0) {
		return { hour12: 12, meridiem: "AM" as const };
	}
	if (hours24 === 12) {
		return { hour12: 12, meridiem: "PM" as const };
	}
	if (hours24 > 12) {
		return { hour12: hours24 - 12, meridiem: "PM" as const };
	}
	return { hour12: hours24, meridiem: "AM" as const };
}

function to24Hour(hour12: number, meridiem: "AM" | "PM") {
	if (meridiem === "AM") {
		return hour12 === 12 ? 0 : hour12;
	}
	return hour12 === 12 ? 12 : hour12 + 12;
}

export function DateTimePicker({
	id,
	value,
	onChange,
	placeholder = "Choose date and time",
	disabled = false,
	className,
}: DateTimePickerProps) {
	const [open, setOpen] = useState(false);
	const selectedDate = parseLocalDateTime(value);
	const selectedTime = selectedDate
		? toMeridiem(selectedDate.getHours())
		: { hour12: DEFAULT_HOUR, meridiem: "AM" as const };
	const selectedMinute = selectedDate?.getMinutes() ?? DEFAULT_MINUTE;

	const minuteOptions = useMemo(() => {
		const baseValues = Array.from({ length: 12 }, (_, index) => index * 5);
		if (selectedDate) {
			baseValues.push(selectedDate.getMinutes());
		}
		return Array.from(new Set(baseValues)).sort((left, right) => left - right);
	}, [selectedDate]);

	function setDateTime(nextDate: Date) {
		onChange(toLocalDateTimeValue(nextDate));
	}

	function handleDateSelect(date?: Date) {
		if (!date) {
			return;
		}
		const nextHours = selectedDate?.getHours() ?? DEFAULT_HOUR;
		const nextMinutes = selectedDate?.getMinutes() ?? DEFAULT_MINUTE;
		setDateTime(
			new Date(
				date.getFullYear(),
				date.getMonth(),
				date.getDate(),
				nextHours,
				nextMinutes,
				0,
				0,
			),
		);
	}

	function handleTimeChange(patch: {
		hour12?: number;
		minute?: number;
		meridiem?: "AM" | "PM";
	}) {
		if (!selectedDate) {
			return;
		}
		const nextHour12 = patch.hour12 ?? selectedTime.hour12;
		const nextMeridiem = patch.meridiem ?? selectedTime.meridiem;
		const nextMinute = patch.minute ?? selectedMinute;
		const nextHours = to24Hour(nextHour12, nextMeridiem);
		setDateTime(
			new Date(
				selectedDate.getFullYear(),
				selectedDate.getMonth(),
				selectedDate.getDate(),
				nextHours,
				nextMinute,
				0,
				0,
			),
		);
	}

	function setNow() {
		onChange(toLocalDateTimeValue(new Date()));
		setOpen(false);
	}

	function setTodayMorning() {
		const today = new Date();
		onChange(
			toLocalDateTimeValue(
				new Date(
					today.getFullYear(),
					today.getMonth(),
					today.getDate(),
					DEFAULT_HOUR,
					DEFAULT_MINUTE,
					0,
					0,
				),
			),
		);
		setOpen(false);
	}

	function clearValue() {
		onChange("");
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					disabled={disabled}
					className={cn(
						"h-11 w-full justify-between rounded-2xl px-4 text-left font-normal",
						className,
					)}
				>
					<span className="flex min-w-0 items-center gap-3">
						<CalendarRange className="size-4 shrink-0 text-muted-foreground" />
						<span
							className={cn(
								"truncate",
								selectedDate ? "text-foreground" : "text-muted-foreground",
							)}
						>
							{selectedDate ? formatTriggerLabel(selectedDate) : placeholder}
						</span>
					</span>
					<Clock3 className="size-4 shrink-0 text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[22rem] rounded-[28px] border border-[var(--brand-border-soft)] bg-background/95 p-4 shadow-xl backdrop-blur"
			>
				<PopoverHeader className="gap-1">
					<PopoverTitle>Planned publish time</PopoverTitle>
					<PopoverDescription className="text-xs leading-5">
						{selectedDate
							? formatPreviewLabel(selectedDate)
							: "Pick a day first, then tune the time below."}
					</PopoverDescription>
				</PopoverHeader>
				<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-3">
					<Calendar
						mode="single"
						selected={selectedDate ?? undefined}
						onSelect={handleDateSelect}
						className="p-0"
					/>
				</div>
				<div className="grid grid-cols-3 gap-3">
					<div className="space-y-2">
						<div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Hour
						</div>
						<Select
							value={String(selectedTime.hour12)}
							onValueChange={(nextValue) =>
								handleTimeChange({ hour12: Number(nextValue) })
							}
							disabled={!selectedDate}
						>
							<SelectTrigger className="data-[size=default]:h-10 w-full rounded-xl px-3">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Array.from({ length: 12 }, (_, index) => index + 1).map(
									(hour) => (
										<SelectItem key={hour} value={String(hour)}>
											{padNumber(hour)}
										</SelectItem>
									),
								)}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Minute
						</div>
						<Select
							value={String(selectedMinute)}
							onValueChange={(nextValue) =>
								handleTimeChange({ minute: Number(nextValue) })
							}
							disabled={!selectedDate}
						>
							<SelectTrigger className="data-[size=default]:h-10 w-full rounded-xl px-3">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{minuteOptions.map((minute) => (
									<SelectItem key={minute} value={String(minute)}>
										{padNumber(minute)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Period
						</div>
						<Select
							value={selectedTime.meridiem}
							onValueChange={(nextValue) =>
								handleTimeChange({ meridiem: nextValue as "AM" | "PM" })
							}
							disabled={!selectedDate}
						>
							<SelectTrigger className="data-[size=default]:h-10 w-full rounded-xl px-3">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="AM">AM</SelectItem>
								<SelectItem value="PM">PM</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="rounded-full"
						onClick={clearValue}
					>
						Clear
					</Button>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={setTodayMorning}
						>
							Today 9 AM
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={setNow}
						>
							Now
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
