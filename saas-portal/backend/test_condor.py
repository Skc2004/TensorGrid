import condor
from pathlib import Path

print("Running Backend Logic Test...")

# 1. Simulate a file upload
file_content = b"print('Hello from HTCondor Grid!')"
filename = "simulation.py"

# 2. Call our condor orchestration function
print(f"Submitting '{filename}' via condor.py...")
job_id = condor.submit_script(file_content, filename)
print(f"Success! Job dispatched with ID: {job_id}")

# 3. Verify the files were generated correctly
job_dir = Path("C:/condor/jobs") / str(job_id).replace("mock_", "")
sub_file = job_dir / "job.sub"
script_file = job_dir / filename

print("\n--- Verifying Generated Files ---")
if script_file.exists():
    print(f"[OK] Python script saved to {script_file}")
    
if sub_file.exists():
    print(f"[OK] HTCondor .sub file generated at {sub_file}")
    print("\n--- Contents of job.sub ---")
    with open(sub_file, "r") as f:
        print(f.read())
        
print("\n--- Testing Queue Status ---")
status = condor.get_job_status()
print(f"Live Queue Feed: {status}")
