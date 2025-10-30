''''
    - Loads student data from CSV file in DataFrame
    - Cleans ata by removing rows with missing values
'''

import pandas as pd

def load_student_data(file_path: str) -> pd.DataFrame:
    # Reads the csv
    df = pd.read_csv(file_path)

    # Drops any rows with missing data
    df.dropna(inplace = True)

    return df


