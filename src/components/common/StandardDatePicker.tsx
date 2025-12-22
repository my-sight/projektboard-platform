import { DatePicker, DatePickerProps } from '@mui/x-date-pickers/DatePicker';
import { Dayjs } from 'dayjs';

export interface StandardDatePickerProps extends DatePickerProps<any> {
    label?: string;
}

export function StandardDatePicker(props: StandardDatePickerProps) {
    return (
        <DatePicker
            displayWeekNumber
            slotProps={{
                textField: {
                    size: 'small',
                    fullWidth: true,
                    variant: 'outlined',
                },
                ...props.slotProps,
            }}
            {...props}
        />
    );
}
